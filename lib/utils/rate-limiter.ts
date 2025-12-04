/**
 * @file lib/utils/rate-limiter.ts
 * @description Rate Limiting 유틸리티
 *
 * 이 파일은 API 요청 빈도를 제한하여 Amazon Bot Detection을 회피하고
 * 서버 부하를 관리합니다.
 *
 * 전략:
 * - 개발 환경: 제한 없음 (빠른 테스트)
 * - 프로덕션: IP당 요청 간격 제한 (30초~1분)
 *
 * @see {@link /docs/PRD.md} - 리스크 관리: Bot Detection 대응
 */

/**
 * Rate Limit 정보 인터페이스
 */
interface RateLimitInfo {
  /** 마지막 요청 시간 (타임스탬프) */
  lastRequestTime: number;
  /** 요청 횟수 */
  requestCount: number;
}

/**
 * Rate Limiter 결과 인터페이스
 */
export interface RateLimitResult {
  /** 요청 허용 여부 */
  allowed: boolean;
  /** 다음 요청까지 대기 시간 (초) */
  retryAfter?: number;
  /** 제한 사유 */
  reason?: string;
}

/**
 * IP별 요청 기록을 저장하는 Map
 * 프로덕션 환경에서만 사용
 */
const requestMap = new Map<string, RateLimitInfo>();

/**
 * Rate Limiting 설정
 */
const RATE_LIMIT_CONFIG = {
  /** 개발 환경에서 Rate Limiting 활성화 여부 */
  enableInDevelopment: false,

  /** 요청 간 최소 간격 (초) - 프로덕션 */
  minIntervalSeconds: 60, // 1분

  /** 시간 윈도우 (밀리초) - 이 시간 내에서 요청 횟수 제한 */
  windowMs: 5 * 60 * 1000, // 5분

  /** 시간 윈도우 내 최대 요청 횟수 */
  maxRequests: 3, // 5분에 3회

  /** 기록 정리 주기 (밀리초) */
  cleanupIntervalMs: 10 * 60 * 1000, // 10분
};

/**
 * 환경 확인 (개발 vs 프로덕션)
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * 오래된 기록 정리 (메모리 관리)
 */
function cleanupOldRecords(): void {
  const now = Date.now();
  const expirationTime = now - RATE_LIMIT_CONFIG.windowMs;

  for (const [ip, info] of requestMap.entries()) {
    if (info.lastRequestTime < expirationTime) {
      requestMap.delete(ip);
    }
  }
}

// 정기적으로 오래된 기록 정리
if (isProduction()) {
  setInterval(cleanupOldRecords, RATE_LIMIT_CONFIG.cleanupIntervalMs);
}

/**
 * Rate Limiting 체크
 *
 * @param identifier - 식별자 (보통 IP 주소)
 * @returns Rate Limit 결과
 *
 * @example
 * const result = checkRateLimit(clientIp);
 * if (!result.allowed) {
 *   return res.status(429).json({
 *     error: result.reason,
 *     retryAfter: result.retryAfter
 *   });
 * }
 */
export function checkRateLimit(identifier: string): RateLimitResult {
  // 개발 환경: Rate Limiting 비활성화
  if (!isProduction() && !RATE_LIMIT_CONFIG.enableInDevelopment) {
    console.log("🔧 [Rate Limiter] 개발 환경 - 제한 없음");
    return { allowed: true };
  }

  const now = Date.now();
  const record = requestMap.get(identifier);

  // 첫 요청인 경우
  if (!record) {
    requestMap.set(identifier, {
      lastRequestTime: now,
      requestCount: 1,
    });
    console.log(`✅ [Rate Limiter] 첫 요청 허용 (${identifier})`);
    return { allowed: true };
  }

  // 시간 윈도우 체크
  const timeSinceLastRequest = now - record.lastRequestTime;
  const windowStart = now - RATE_LIMIT_CONFIG.windowMs;

  // 최소 간격 체크
  const minIntervalMs = RATE_LIMIT_CONFIG.minIntervalSeconds * 1000;
  if (timeSinceLastRequest < minIntervalMs) {
    const retryAfter = Math.ceil((minIntervalMs - timeSinceLastRequest) / 1000);
    console.warn(
      `⚠️  [Rate Limiter] 요청 거부 (${identifier}) - 최소 간격 미달 (${retryAfter}초 후 재시도)`
    );
    return {
      allowed: false,
      retryAfter,
      reason: `너무 많은 요청입니다. ${retryAfter}초 후에 다시 시도해 주세요.`,
    };
  }

  // 윈도우 내 요청 횟수 체크
  if (record.lastRequestTime >= windowStart) {
    if (record.requestCount >= RATE_LIMIT_CONFIG.maxRequests) {
      const retryAfter = Math.ceil(
        (RATE_LIMIT_CONFIG.windowMs - (now - windowStart)) / 1000
      );
      console.warn(
        `⚠️  [Rate Limiter] 요청 거부 (${identifier}) - 최대 요청 횟수 초과 (${retryAfter}초 후 재시도)`
      );
      return {
        allowed: false,
        retryAfter,
        reason: `요청 한도를 초과했습니다. ${retryAfter}초 후에 다시 시도해 주세요.`,
      };
    }

    // 요청 횟수 증가
    record.requestCount++;
    record.lastRequestTime = now;
    console.log(
      `✅ [Rate Limiter] 요청 허용 (${identifier}) - ${record.requestCount}/${RATE_LIMIT_CONFIG.maxRequests}`
    );
  } else {
    // 새로운 윈도우 시작
    record.requestCount = 1;
    record.lastRequestTime = now;
    console.log(
      `✅ [Rate Limiter] 새 윈도우 시작 (${identifier}) - 요청 허용`
    );
  }

  requestMap.set(identifier, record);
  return { allowed: true };
}

/**
 * 클라이언트 IP 주소 추출
 *
 * @param request - Next.js Request 객체
 * @returns IP 주소
 */
export function getClientIp(request: Request): string {
  // Vercel/Production 환경에서 실제 IP 가져오기
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwardedFor) {
    // x-forwarded-for는 여러 IP가 올 수 있음 (첫 번째가 실제 클라이언트)
    return forwardedFor.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  // 로컬 개발 환경
  return "127.0.0.1";
}

/**
 * Rate Limit 통계 조회 (디버깅용)
 */
export function getRateLimitStats(): {
  totalRecords: number;
  records: Array<{ ip: string; info: RateLimitInfo }>;
} {
  return {
    totalRecords: requestMap.size,
    records: Array.from(requestMap.entries()).map(([ip, info]) => ({
      ip,
      info,
    })),
  };
}

/**
 * Rate Limit 기록 초기화 (테스트용)
 */
export function resetRateLimits(): void {
  requestMap.clear();
  console.log("🔄 [Rate Limiter] 모든 기록 초기화");
}

/**
 * 특정 IP의 Rate Limit 초기화 (관리자용)
 */
export function resetRateLimitForIp(ip: string): boolean {
  const deleted = requestMap.delete(ip);
  if (deleted) {
    console.log(`🔄 [Rate Limiter] ${ip} 기록 초기화`);
  }
  return deleted;
}

