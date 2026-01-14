/**
 * @file types/shopify.ts
 * @description Shopify Admin API 타입 정의
 *
 * Shopify API와 상호작용하기 위한 타입들을 정의합니다.
 * 
 * @see https://shopify.dev/docs/api/admin-rest/2025-01/resources/product
 */

/**
 * Shopify 이미지 객체
 */
export interface ShopifyImage {
  /** 이미지 URL */
  src: string;
  
  /** 이미지 alt 텍스트 (선택사항) */
  alt?: string;
  
  /** 이미지 위치 (선택사항, 0부터 시작) */
  position?: number;
}

/**
 * Shopify 상품 옵션 (Variant)
 */
export interface ShopifyVariant {
  /** 가격 (문자열 형태, 예: "29.99") */
  price: string;
  
  /** SKU (재고 관리 코드, 선택사항) */
  sku?: string;
  
  /** 재고 수량 (선택사항) */
  inventory_quantity?: number;
  
  /** 옵션1 (예: 색상) */
  option1?: string;
  
  /** 옵션2 (예: 사이즈) */
  option2?: string;
  
  /** 옵션3 */
  option3?: string;
  
  /** 무게 (그램 단위, 선택사항) */
  weight?: number;
  
  /** 무게 단위 (기본값: "kg", 선택사항) */
  weight_unit?: string;
}

/**
 * Shopify 상품 옵션 정의
 */
export interface ShopifyOption {
  /** 옵션 이름 (예: "Color", "Size") */
  name: string;
  
  /** 옵션 값 배열 (예: ["Red", "Blue", "Green"]) */
  values: string[];
}

/**
 * Shopify 상품 생성 요청 데이터
 */
export interface ShopifyProductInput {
  /** 상품명 */
  title: string;
  
  /** 상품 설명 (HTML 형식) */
  body_html?: string;
  
  /** 판매자/브랜드 이름 */
  vendor?: string;
  
  /** 상품 타입/카테고리 */
  product_type?: string;
  
  /** 상품 상태 ("active" | "draft" | "archived") */
  status?: "active" | "draft" | "archived";
  
  /** 이미지 배열 */
  images?: ShopifyImage[];
  
  /** 상품 옵션 정의 배열 */
  options?: ShopifyOption[];
  
  /** 상품 옵션 배열 */
  variants?: ShopifyVariant[];
  
  /** 태그 (쉼표로 구분된 문자열) */
  tags?: string;
}

/**
 * Shopify API 응답 - 상품 객체
 */
export interface ShopifyProduct {
  /** Shopify 상품 ID */
  id: number;
  
  /** 상품명 */
  title: string;
  
  /** 상품 핸들 (URL 친화적 이름) */
  handle: string;
  
  /** 상품 설명 */
  body_html: string;
  
  /** 판매자 */
  vendor: string;
  
  /** 상품 타입 */
  product_type: string;
  
  /** 상품 상태 */
  status: string;
  
  /** 이미지 배열 */
  images: ShopifyImage[];
  
  /** 옵션 배열 */
  variants: ShopifyVariant[];
  
  /** 생성 일시 */
  created_at: string;
  
  /** 수정 일시 */
  updated_at: string;
}

/**
 * Shopify API 응답 타입 (상품 생성)
 */
export interface ShopifyProductResponse {
  /** 생성된 상품 객체 */
  product: ShopifyProduct;
}

/**
 * Shopify API 에러 응답
 */
export interface ShopifyErrorResponse {
  /** 에러 객체 */
  errors?: Record<string, string[]> | string;
  
  /** 에러 메시지 */
  error?: string;
  
  /** 에러 설명 */
  error_description?: string;
}

/**
 * 상품 생성 결과
 */
export interface CreateProductResult {
  /** 성공 여부 */
  success: boolean;
  
  /** Shopify 상품 ID (성공 시) */
  shopifyProductId?: number;
  
  /** 에러 메시지 (실패 시) */
  error?: string;
  
  /** 재시도 횟수 */
  retries?: number;
  
  /** HTTP 상태 코드 */
  statusCode?: number;
}

