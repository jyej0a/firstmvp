/**
 * @file lib/utils/error-handler.ts
 * @description 스크래핑 오류 분류 및 처리 유틸리티
 *
 * 이 파일은 스크래핑 중 발생하는 오류를 분류하고,
 * 데이터베이스에 저장할 수 있는 형태로 변환하는 기능을 제공합니다.
 *
 * 주요 기능:
 * 1. 오류 메시지를 분석하여 오류 코드 분류
 * 2. 사용자 친화적인 오류 원인 메시지 생성
 * 3. 상세 오류 정보 수집 (스택 트레이스 등)
 */

/**
 * 오류 코드 타입
 */
export type ErrorCode =
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "BOT_DETECTED"
  | "ELEMENT_NOT_FOUND"
  | "NO_PRODUCTS_FOUND"
  | "INDEX_OUT_OF_RANGE"
  | "RATE_LIMIT_EXCEEDED"
  | "DUPLICATE_ASIN"
  | "UNKNOWN_ERROR";

/**
 * 오류 정보 인터페이스
 */
export interface ErrorInfo {
  code: ErrorCode;
  reason: string;
  detail: string;
}

/**
 * 오류를 분석하여 분류된 오류 정보 반환
 *
 * @param error - 발생한 오류 객체 또는 메시지
 * @param context - 추가 컨텍스트 정보 (선택사항)
 * @returns 분류된 오류 정보
 */
export function categorizeError(
  error: unknown,
  context?: {
    offset?: number;
    searchUrl?: string;
    productsCount?: number;
    targetIndex?: number;
  }
): ErrorInfo {
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // 오류 메시지 분석
  const lowerMessage = errorMessage.toLowerCase();

  // 1. 타임아웃 오류
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("navigation timeout")
  ) {
    return {
      code: "TIMEOUT",
      reason: "페이지 로딩 시간이 초과되었습니다",
      detail: buildErrorDetail(errorMessage, errorStack, context),
    };
  }

  // 2. 네트워크 오류
  if (
    lowerMessage.includes("network") ||
    lowerMessage.includes("connection") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("enotfound")
  ) {
    return {
      code: "NETWORK_ERROR",
      reason: "네트워크 연결에 실패했습니다",
      detail: buildErrorDetail(errorMessage, errorStack, context),
    };
  }

  // 3. 봇 감지 오류
  if (
    lowerMessage.includes("bot") ||
    lowerMessage.includes("captcha") ||
    lowerMessage.includes("blocked") ||
    lowerMessage.includes("access denied")
  ) {
    return {
      code: "BOT_DETECTED",
      reason: "봇으로 감지되어 차단되었습니다",
      detail: buildErrorDetail(errorMessage, errorStack, context),
    };
  }

  // 4. 요소를 찾을 수 없음
  if (
    lowerMessage.includes("element not found") ||
    lowerMessage.includes("selector") ||
    lowerMessage.includes("waiting for selector")
  ) {
    return {
      code: "ELEMENT_NOT_FOUND",
      reason: "상품 정보를 찾을 수 없습니다 (페이지 구조 변경 가능)",
      detail: buildErrorDetail(errorMessage, errorStack, context),
    };
  }

  // 5. 상품이 없음 (페이지에 아무 상품도 없음)
  if (
    lowerMessage.includes("페이지에 상품이 없습니다") ||
    (lowerMessage.includes("no products found") && !lowerMessage.includes("인덱스"))
  ) {
    return {
      code: "NO_PRODUCTS_FOUND",
      reason: "페이지에 상품이 없습니다",
      detail: buildErrorDetail(errorMessage, errorStack, context, {
        note: context?.productsCount
          ? `페이지 상품 수: ${context.productsCount}개`
          : undefined,
      }),
    };
  }

  // 6. 인덱스 범위 초과 (결과가 null인 경우 포함)
  if (
    lowerMessage.includes("결과가 null") ||
    lowerMessage.includes("인덱스") ||
    lowerMessage.includes("범위를 벗어남") ||
    lowerMessage.includes("index out of range")
  ) {
    return {
      code: "INDEX_OUT_OF_RANGE",
      reason: "요청한 상품 인덱스가 범위를 벗어났습니다 (필터링으로 일부 상품이 제외되었을 수 있음)",
      detail: buildErrorDetail(errorMessage, errorStack, context, {
        note:
          context?.targetIndex !== undefined && context?.productsCount !== undefined
            ? `요청 인덱스: ${context.targetIndex}, 추출된 유효 상품 수: ${context.productsCount}개 (필터링으로 제외된 상품이 있을 수 있음)`
            : context?.targetIndex !== undefined
            ? `요청 인덱스: ${context.targetIndex}`
            : undefined,
      }),
    };
  }

  // 7. Rate Limit 초과
  if (
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("too many requests") ||
    lowerMessage.includes("429")
  ) {
    return {
      code: "RATE_LIMIT_EXCEEDED",
      reason: "요청이 너무 많아서 차단되었습니다",
      detail: buildErrorDetail(errorMessage, errorStack, context),
    };
  }

  // 8. 중복 ASIN
  if (
    lowerMessage.includes("중복") ||
    lowerMessage.includes("duplicate") ||
    lowerMessage.includes("already exists")
  ) {
    return {
      code: "DUPLICATE_ASIN",
      reason: "이미 존재하는 상품입니다",
      detail: buildErrorDetail(errorMessage, errorStack, context),
    };
  }

  // 9. 알 수 없는 오류
  return {
    code: "UNKNOWN_ERROR",
    reason: "알 수 없는 오류가 발생했습니다",
    detail: buildErrorDetail(errorMessage, errorStack, context),
  };
}

/**
 * 오류 상세 정보 생성
 *
 * @param message - 오류 메시지
 * @param stack - 스택 트레이스 (선택사항)
 * @param context - 추가 컨텍스트 (선택사항)
 * @param additional - 추가 정보 (선택사항)
 * @returns 오류 상세 정보 문자열
 */
function buildErrorDetail(
  message: string,
  stack?: string,
  context?: {
    offset?: number;
    searchUrl?: string;
    productsCount?: number;
    targetIndex?: number;
  },
  additional?: {
    note?: string;
  }
): string {
  const parts: string[] = [];

  // 기본 메시지
  parts.push(`오류 메시지: ${message}`);

  // 컨텍스트 정보
  if (context) {
    if (context.offset !== undefined) {
      parts.push(`Offset: ${context.offset}`);
    }
    if (context.targetIndex !== undefined) {
      parts.push(`Target Index: ${context.targetIndex}`);
    }
    if (context.productsCount !== undefined) {
      parts.push(`Products Count: ${context.productsCount}`);
    }
    if (context.searchUrl) {
      parts.push(`Search URL: ${context.searchUrl}`);
    }
  }

  // 추가 정보
  if (additional?.note) {
    parts.push(`참고: ${additional.note}`);
  }

  // 스택 트레이스 (최대 500자로 제한)
  if (stack) {
    const truncatedStack = stack.length > 500 ? stack.substring(0, 500) + "..." : stack;
    parts.push(`\n스택 트레이스:\n${truncatedStack}`);
  }

  return parts.join("\n");
}

/**
 * 오류 정보를 데이터베이스 업데이트 형식으로 변환
 *
 * @param errorInfo - 분류된 오류 정보
 * @returns 데이터베이스 업데이트용 객체
 */
export function errorInfoToDbUpdate(errorInfo: ErrorInfo): {
  error_code: string;
  error_reason: string;
  error_detail: string;
  failed_at: string;
} {
  return {
    error_code: errorInfo.code,
    error_reason: errorInfo.reason,
    error_detail: errorInfo.detail,
    failed_at: new Date().toISOString(),
  };
}

