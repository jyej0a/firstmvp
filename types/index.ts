/**
 * @file types/index.ts
 * @description Trend-Hybrid Admin 프로젝트의 핵심 타입 정의
 *
 * 이 파일은 스크래핑된 상품 데이터 및 시스템 전반에서 사용되는 타입을 정의합니다.
 * PRD.md의 데이터 항목 명세를 기반으로 작성되었습니다.
 */

/**
 * 소싱 타입 (Sourcing Type)
 * - US: 아마존 가격 기반 계산 (amazonPrice × (1 + marginRate))
 * - CN: 타오바오 원가 기반 계산 ((costPrice + shipping + extra) / (1 - marginRate))
 */
export type SourcingType = "US" | "CN";

/**
 * 상품 상태 (Product Status)
 * - draft: 수집 완료, 아직 Shopify 등록 전
 * - uploaded: Shopify 등록 완료
 * - error: Shopify 등록 실패
 */
export type ProductStatus = "draft" | "uploaded" | "error";

/**
 * 스크래핑 모드 (Scraping Mode)
 * - collect_only: 수집만 진행 (DB 저장만)
 * - collect_sync: 수집 후 Shopify 자동 등록
 */
export type ScrapingMode = "collect_only" | "collect_sync";

/**
 * 스크래핑된 원시 데이터 인터페이스
 * 아마존에서 직접 추출한 데이터 (가공 전)
 */
export interface ScrapedProductRaw {
  /** 아마존 고유 상품 식별자 (ASIN) */
  asin: string;

  /** 상품명 (원본 그대로) */
  title: string;

  /** 상품 이미지 URL 배열 */
  images: string[];

  /** 아마존 판매 가격 (달러) */
  amazonPrice: number;

  /** 아마존 상품 URL */
  sourceUrl: string;

  /** 상품 옵션 정보 (예: 색상, 크기 등) */
  variants?: string[];

  /** 상품 설명 (HTML 또는 텍스트) */
  description?: string;

  /** 상품 카테고리 (선택값, 없으면 저장 시 'General' 사용) */
  category?: string;

  /** 리뷰 개수 (선택값) */
  reviewCount?: number;

  /** 평점 (선택값, 0-5 범위) */
  rating?: number;

  /** 브랜드명 (선택값) */
  brand?: string;

  /** 상품 무게 (선택값, 킬로그램 단위) */
  weight?: number;
}

/**
 * 최종 상품 데이터 인터페이스
 * DB에 저장되고 시스템에서 사용되는 완전한 상품 정보
 */
export interface Product {
  /** 데이터베이스 고유 ID */
  id: string;

  /** 사용자 ID (Clerk User ID) */
  userId: string;

  /** 아마존 고유 상품 식별자 (ASIN) */
  asin: string;

  /** 아마존 상품 URL */
  sourceUrl: string;

  /** 상품명 */
  title: string;

  /** 상품 설명 */
  description: string | null;

  /** 상품 이미지 URL 배열 */
  images: string[];

  /** 상품 옵션 정보 (JSONB 형태로 저장) */
  variants: Record<string, any> | null;

  /** 상품 카테고리 (필수값, NOT NULL) */
  category: string;

  /** 리뷰 개수 (선택값) */
  reviewCount: number | null;

  /** 평점 (선택값, 0-5 범위) */
  rating: number | null;

  /** 브랜드명 (선택값) */
  brand: string | null;

  /** 상품 무게 (선택값, 킬로그램 단위) */
  weight: number | null;

  /** 소싱 타입 (US/CN) */
  sourcingType: SourcingType;

  /** 아마존 판매 가격 (달러) */
  amazonPrice: number;

  /** 타오바오 원가 (달러) - CN 타입 전용 */
  costPrice: number | null;

  /** 배송비 (달러) - CN 타입 전용 */
  shippingCost: number | null;

  /** 추가 비용 (관세 등, 달러) - CN 타입 전용 */
  extraCost: number | null;

  /** 희망 마진율 (0-100 사이 숫자, 예: 40 = 40%) */
  marginRate: number;

  /** 최종 판매 가격 (달러, 자동 계산) */
  sellingPrice: number;

  /** 상품 상태 */
  status: ProductStatus;

  /** 에러 메시지 (상태가 error일 때) */
  errorMessage: string | null;

  /** 생성 일시 */
  createdAt: string;

  /** 수정 일시 */
  updatedAt: string;
}

/**
 * 금지어 인터페이스
 * IP/브랜드명 필터링을 위한 금지어 목록
 */
export interface BannedKeyword {
  /** 데이터베이스 고유 ID */
  id: string;

  /** 금지어 키워드 (대소문자 구분 없음) */
  keyword: string;

  /** 생성 일시 */
  createdAt: string;
}

/**
 * 스크래핑 결과 통계
 */
export interface ScrapingStats {
  /** 총 수집된 상품 개수 */
  totalScraped: number;

  /** 금지어 필터링으로 제거된 개수 */
  filteredOut?: number;

  /** DB에 저장된 상품 개수 */
  saved?: number;

  /** 저장 실패한 개수 */
  failed?: number;

  /** 최종 상품 개수 (저장 성공한 개수) */
  finalCount?: number;

  /** 스크래핑 소요 시간 (ms) */
  duration?: number;

  /** 수집한 페이지 개수 */
  pagesScraped?: number;
}

/**
 * API 응답 공통 타입
 */
export interface ApiResponse<T = any> {
  /** 성공 여부 */
  success: boolean;

  /** 응답 데이터 */
  data?: T;

  /** 에러 메시지 */
  error?: string;

  /** 추가 메시지 (선택사항) */
  message?: string;

  /** Rate Limit 초과 시 재시도까지 대기 시간 (초) */
  retryAfter?: number;
}

/**
 * Shopify 업로드 결과
 */
export interface ShopifyUploadResult {
  /** 업로드 시도한 총 상품 개수 */
  total: number;

  /** 성공한 개수 */
  success: number;

  /** 실패한 개수 */
  failed: number;

  /** 성공한 상품 ID 목록 */
  successIds: string[];

  /** 실패한 상품 상세 정보 */
  failures: Array<{
    productId: string;
    asin: string;
    error: string;
  }>;
}

