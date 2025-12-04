/**
 * @file url-processor.ts
 * @description Amazon 검색 입력 처리 유틸리티
 * 
 * 이 파일은 사용자가 입력한 키워드 또는 URL을 처리하여
 * 적절한 Amazon 검색 URL을 생성하거나 검증합니다.
 * 
 * 주요 기능:
 * 1. 입력값이 URL인지 키워드인지 판단
 * 2. URL인 경우 amazon.com 도메인 검증
 * 3. 키워드인 경우 Amazon 검색 URL 생성
 * 4. 빈 값 및 잘못된 입력 예외 처리
 * 
 * @see {@link /docs/PRD.md} - 기능 명세 참조
 * @see {@link /docs/TODO.md#2.2} - 구현 계획
 */

/**
 * 처리 결과 타입
 */
export interface ProcessedSearchInput {
  /** 처리된 URL (Amazon 검색 URL 또는 검증된 URL) */
  url: string;
  /** 원본 입력값 */
  originalInput: string;
  /** 입력 타입 (키워드 또는 URL) */
  type: 'keyword' | 'url';
}

/**
 * 사용자 입력을 처리하여 Amazon 검색 URL을 생성하거나 검증합니다.
 * 
 * @param input - 사용자가 입력한 키워드 또는 URL
 * @returns 처리된 검색 정보
 * @throws {Error} 입력값이 유효하지 않은 경우
 * 
 * @example
 * // 키워드 입력
 * const result = processSearchInput("neck device");
 * // { url: "https://www.amazon.com/s?k=neck+device", type: "keyword", ... }
 * 
 * @example
 * // URL 입력
 * const result = processSearchInput("https://www.amazon.com/s?k=phone");
 * // { url: "https://www.amazon.com/s?k=phone", type: "url", ... }
 */
export function processSearchInput(input: string): ProcessedSearchInput {
  // 1. 빈 값 검증
  const trimmedInput = input.trim();
  
  if (!trimmedInput) {
    throw new Error('검색어 또는 URL을 입력해 주세요.');
  }

  // 2. URL 여부 판단 (http 또는 https로 시작하는지 확인)
  const isUrl = /^https?:\/\//i.test(trimmedInput);

  if (isUrl) {
    // 3. URL인 경우: amazon.com 도메인 검증
    return validateAndProcessUrl(trimmedInput);
  } else {
    // 4. 키워드인 경우: Amazon 검색 URL 생성
    return createAmazonSearchUrl(trimmedInput);
  }
}

/**
 * URL을 검증하고 처리합니다.
 * 
 * @param urlString - 검증할 URL 문자열
 * @returns 처리된 검색 정보
 * @throws {Error} URL이 유효하지 않거나 Amazon 도메인이 아닌 경우
 */
function validateAndProcessUrl(urlString: string): ProcessedSearchInput {
  try {
    const url = new URL(urlString);
    
    // Amazon 도메인 검증 (amazon.com, amazon.co.uk 등)
    const isAmazonDomain = /amazon\.(com|co\.uk|ca|de|fr|es|it|jp|cn|in)/i.test(url.hostname);
    
    if (!isAmazonDomain) {
      throw new Error('Amazon URL만 사용할 수 있습니다. (예: amazon.com)');
    }

    // 유효한 Amazon URL
    return {
      url: urlString,
      originalInput: urlString,
      type: 'url',
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Amazon')) {
      throw error; // Amazon 도메인 에러는 그대로 전달
    }
    throw new Error('올바른 URL 형식이 아닙니다. (예: https://www.amazon.com/...)');
  }
}

/**
 * 키워드로 Amazon 검색 URL을 생성합니다.
 * 
 * @param keyword - 검색 키워드
 * @returns 처리된 검색 정보
 * 
 * @example
 * createAmazonSearchUrl("neck device")
 * // { url: "https://www.amazon.com/s?k=neck+device", ... }
 */
function createAmazonSearchUrl(keyword: string): ProcessedSearchInput {
  // 키워드를 URL 인코딩 (공백은 +로 변환)
  const encodedKeyword = encodeURIComponent(keyword).replace(/%20/g, '+');
  
  // Amazon 검색 URL 생성
  const amazonSearchUrl = `https://www.amazon.com/s?k=${encodedKeyword}`;

  return {
    url: amazonSearchUrl,
    originalInput: keyword,
    type: 'keyword',
  };
}

/**
 * 입력값이 유효한지 검증합니다 (빈 값 체크용 헬퍼 함수)
 * 
 * @param input - 검증할 입력값
 * @returns 유효 여부
 */
export function isValidInput(input: string): boolean {
  return input.trim().length > 0;
}

