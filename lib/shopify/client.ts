/**
 * @file lib/shopify/client.ts
 * @description Shopify Admin API 클라이언트
 *
 * 이 파일은 Shopify에 상품을 생성하는 API 클라이언트를 제공합니다.
 *
 * 주요 기능:
 * 1. 상품 생성 (createProduct)
 * 2. 에러 핸들링 및 재시도 로직
 * 3. Rate Limit 대응
 *
 * @see {@link /docs/PRD.md} - Shopify 연동 명세
 * @see {@link /docs/TODO.md#2.19} - 구현 계획
 */

import type { Product } from "@/types";
import type {
  ShopifyProductInput,
  ShopifyProductResponse,
  ShopifyErrorResponse,
  CreateProductResult,
  ShopifyImage,
  ShopifyVariant,
} from "@/types/shopify";

/**
 * Shopify 설정 검증 결과
 */
interface ConfigValidation {
  valid: boolean;
  error?: string;
}

/**
 * 환경변수 검증
 * 
 * SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN, SHOPIFY_API_VERSION이
 * 모두 설정되어 있는지 확인합니다.
 */
function validateShopifyConfig(): ConfigValidation {
  const storeUrl = process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION;

  if (!storeUrl) {
    return {
      valid: false,
      error: "SHOPIFY_STORE_URL 환경변수가 설정되지 않았습니다.",
    };
  }

  if (!accessToken) {
    return {
      valid: false,
      error: "SHOPIFY_ACCESS_TOKEN 환경변수가 설정되지 않았습니다.",
    };
  }

  if (!apiVersion) {
    return {
      valid: false,
      error: "SHOPIFY_API_VERSION 환경변수가 설정되지 않았습니다.",
    };
  }

  return { valid: true };
}

/**
 * Product 타입을 Shopify API 형식으로 변환
 * 
 * @param product - 변환할 상품 데이터
 * @returns Shopify API 요청 형식의 상품 데이터
 */
function formatProductForShopify(product: Product): ShopifyProductInput {
  // 이미지 중복 제거 (이중 안전장치)
  const { deduplicateImages } = require("@/lib/utils/image-deduplicator");
  const uniqueImages = deduplicateImages(product.images);
  
  // 이미지 배열 변환 (최대 10개, 중복 제거 후)
  const images: ShopifyImage[] = uniqueImages
    .slice(0, 10)
    .map((url, index) => ({
      src: url,
      alt: product.title,
      position: index + 1,
    }));

  // 가격 포맷팅 (소수점 2자리)
  const price = product.sellingPrice.toFixed(2);

  // 기본 variant 생성
  const variants: ShopifyVariant[] = [
    {
      price,
      sku: product.asin, // ASIN을 SKU로 사용
      inventory_quantity: 0, // 드롭쉬핑이므로 재고 0
    },
  ];

  return {
    title: product.title,
    body_html: product.description || "",
    vendor: "Trend-Hybrid",
    product_type: "General",
    status: "draft", // 기본값: draft (향후 옵션화 가능)
    images,
    variants,
    tags: `amazon,${product.sourcingType},asin:${product.asin}`,
  };
}

/**
 * HTTP 상태 코드별 에러 메시지 생성
 * 
 * @param status - HTTP 상태 코드
 * @param errorBody - 에러 응답 바디
 * @returns 사용자 친화적인 에러 메시지
 */
function handleShopifyError(
  status: number,
  errorBody: ShopifyErrorResponse | null
): string {
  // Shopify API 에러 메시지 추출
  let apiError = "";
  if (errorBody) {
    if (typeof errorBody.errors === "string") {
      apiError = errorBody.errors;
    } else if (errorBody.errors) {
      apiError = JSON.stringify(errorBody.errors);
    } else if (errorBody.error) {
      apiError = errorBody.error;
    }
  }

  switch (status) {
    case 401:
      return `Access Token이 잘못되었거나 만료되었습니다. ${apiError}`;
    case 403:
      return `권한이 부족합니다. API 스코프를 확인하세요. ${apiError}`;
    case 404:
      return `스토어 URL 또는 API 버전이 잘못되었습니다. ${apiError}`;
    case 422:
      return `상품 데이터 유효성 오류: ${apiError}`;
    case 429:
      return `API 요청 한도 초과. 잠시 후 재시도합니다.`;
    case 500:
    case 502:
    case 503:
    case 504:
      return `Shopify 서버 오류 (${status}). ${apiError}`;
    default:
      return `알 수 없는 오류 (${status}). ${apiError}`;
  }
}

/**
 * 재시도 가능한 에러인지 확인
 * 
 * @param status - HTTP 상태 코드
 * @returns 재시도 가능 여부
 */
function isRetryableError(status: number): boolean {
  // 429 (Rate Limit), 500, 502, 503, 504 (서버 오류)는 재시도 가능
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * 지수 백오프를 사용한 재시도 로직
 * 
 * @param fn - 재시도할 함수
 * @param maxRetries - 최대 재시도 횟수 (기본값: 3)
 * @returns 함수 실행 결과
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 마지막 시도면 에러 던지기
      if (attempt === maxRetries) {
        throw lastError;
      }

      // 지수 백오프 대기 (1초, 2초, 4초)
      const delaySeconds = Math.pow(2, attempt);
      console.log(
        `⏳ 재시도 ${attempt + 1}/${maxRetries} - ${delaySeconds}초 대기 중...`
      );
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }
  }

  throw lastError;
}

/**
 * Shopify에 상품 생성
 * 
 * @param product - 생성할 상품 데이터
 * @returns 생성 결과
 * 
 * @example
 * const result = await createProduct(product);
 * if (result.success) {
 *   console.log(`상품 생성 성공: ${result.shopifyProductId}`);
 * } else {
 *   console.error(`상품 생성 실패: ${result.error}`);
 * }
 */
export async function createProduct(
  product: Product
): Promise<CreateProductResult> {
  console.group(`🛒 [Shopify] 상품 생성 시작: ${product.title.substring(0, 50)}...`);

  try {
    // 1. 환경변수 검증
    const configValidation = validateShopifyConfig();
    if (!configValidation.valid) {
      console.error("❌ 환경변수 검증 실패:", configValidation.error);
      console.groupEnd();
      return {
        success: false,
        error: configValidation.error,
        statusCode: 500,
      };
    }

    // 2. 상품 데이터 변환
    const shopifyProduct = formatProductForShopify(product);
    console.log("📦 변환된 상품 데이터:", {
      title: shopifyProduct.title,
      price: shopifyProduct.variants?.[0]?.price,
      images: shopifyProduct.images?.length,
    });

    // 3. API 요청 함수 정의
    const makeRequest = async () => {
      const url = `${process.env.SHOPIFY_STORE_URL}/admin/api/${process.env.SHOPIFY_API_VERSION}/products.json`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product: shopifyProduct }),
      });

      const responseData = (await response.json()) as
        | ShopifyProductResponse
        | ShopifyErrorResponse;

      // 에러 처리
      if (!response.ok) {
        const errorMessage = handleShopifyError(
          response.status,
          responseData as ShopifyErrorResponse
        );

        // 재시도 가능한 에러면 에러 던지기 (retryWithBackoff가 처리)
        if (isRetryableError(response.status)) {
          throw new Error(errorMessage);
        }

        // 재시도 불가능한 에러면 바로 실패 결과 반환
        return {
          success: false,
          error: errorMessage,
          statusCode: response.status,
        };
      }

      // 성공
      const productData = responseData as ShopifyProductResponse;
      return {
        success: true,
        shopifyProductId: productData.product.id,
        statusCode: response.status,
      };
    };

    // 4. 재시도 로직과 함께 요청 실행
    const result = await retryWithBackoff(makeRequest, 3);

    if (result.success) {
      console.log(`✅ 상품 생성 성공! Shopify ID: ${result.shopifyProductId}`);
    } else {
      console.error(`❌ 상품 생성 실패: ${result.error}`);
    }

    console.groupEnd();
    return result;
  } catch (error) {
    console.error("❌ 예외 발생:", error);
    console.groupEnd();

    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
      statusCode: 500,
    };
  }
}

