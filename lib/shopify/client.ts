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
  ShopifyOption,
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
 * @param shopifyCategoryId - (옵션) 매칭된 Shopify 카테고리 ID
 * @param shopifyCategoryName - (옵션) 매칭된 Shopify 카테고리 이름
 * @returns Shopify API 요청 형식의 상품 데이터
 */
function formatProductForShopify(
  product: Product,
  shopifyCategoryId?: string,
  shopifyCategoryName?: string
): ShopifyProductInput {
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

  // Variants 처리: DB에 저장된 variants 정보 파싱
  const variants: ShopifyVariant[] = [];
  
  // 기본 variant 생성
  const baseVariant: ShopifyVariant = {
      price,
      sku: product.asin, // ASIN을 SKU로 사용
      inventory_quantity: 100, // 기본 재고 수량 100
  };

  // 무게 정보 추가 (킬로그램 → 그램 변환)
  if (product.weight !== null && product.weight !== undefined) {
    baseVariant.weight = Math.round(product.weight * 1000); // 킬로그램 → 그램
    baseVariant.weight_unit = "g";
  }

  // variants 옵션 파싱 및 Shopify options 생성
  // DB에 저장된 형태:
  //   - 배열: ["Color: Black", "Size: Large"]
  //   - 또는 객체: { options: ["Color: Black", "Size: Large"] }
  const shopifyOptions: ShopifyOption[] = [];
  
  if (product.variants) {
    let optionsArray: string[] = [];

    // 배열 형태인 경우 (현재 amazon-scraper.ts가 반환하는 형태)
    if (Array.isArray(product.variants)) {
      optionsArray = product.variants;
    } 
    // 객체 형태인 경우 (하위 호환성)
    else if (typeof product.variants === 'object') {
      const variantsData = product.variants as { options?: string[] };
      if (variantsData.options && Array.isArray(variantsData.options)) {
        optionsArray = variantsData.options;
      }
    }

    // 옵션을 파싱하여:
    // 1. baseVariant의 option1, option2, option3에 할당
    // 2. Shopify options 배열 생성
    // 예: "Color: Black" → { name: "Color", values: ["Black"] }
    optionsArray.forEach((option, index) => {
      if (!option || typeof option !== 'string') return;

      // "Color: Black" 형태에서 이름과 값 분리
      const colonIndex = option.indexOf(':');
      let name = '';
      let value = '';

      if (colonIndex > -1) {
        name = option.substring(0, colonIndex).trim();
        value = option.substring(colonIndex + 1).trim();
      } else {
        // 콜론이 없으면 전체를 값으로 사용, 이름은 "Option N"
        name = `Option ${index + 1}`;
        value = option.trim();
      }

      if (!value) return;

      // baseVariant에 옵션 값 설정
      if (index === 0) {
        baseVariant.option1 = value;
      } else if (index === 1) {
        baseVariant.option2 = value;
      } else if (index === 2) {
        baseVariant.option3 = value;
      }

      // Shopify options 배열에 추가
      shopifyOptions.push({
        name: name,
        values: [value],
      });
    });
  }

  variants.push(baseVariant);

  // 카테고리 처리
  // 1. 매칭된 Shopify 카테고리 이름이 있으면 우선 사용
  // 2. 없으면 DB의 category 필드에서 마지막 부분 추출
  let productType = "General";
  
  if (shopifyCategoryName) {
    // 매칭된 Shopify 카테고리가 있으면 마지막 부분만 추출하여 사용
    const categoryParts = shopifyCategoryName.split(" > ");
    productType = categoryParts[categoryParts.length - 1] || shopifyCategoryName;
    console.log(`✅ 매칭된 카테고리를 product_type으로 설정: ${productType}`);
  } else if (product.category && product.category !== "General") {
    // 매칭 실패 시 아마존 카테고리 사용
    const categoryParts = product.category.split(" > ");
    productType = categoryParts[categoryParts.length - 1] || product.category;
    console.log(`⚠️  매칭 실패, 아마존 카테고리 사용: ${productType}`);
  }
  
  // 참고: Shopify Standard Product Taxonomy 카테고리 ID는 REST API에서 미지원
  // GraphQL API로 전환 시 shopifyCategoryId 사용 가능

  // 브랜드명 처리: DB에 저장된 브랜드명은 참고만 하고, 쇼피파이에는 "Talent Market"으로 통일
  const vendor = "Talent Market";

  // Shopify API 요청 데이터 생성
  const shopifyProduct: ShopifyProductInput = {
    title: product.title,
    body_html: product.description || "",
    vendor,
    product_type: productType,
    status: "draft", // 기본값: draft (향후 옵션화 가능)
    images,
    variants,
    tags: `asin:${product.asin}`, // ASIN만 태그로 저장 (amazon, US 등 제외)
  };

  // options가 있으면 추가 (variants와 함께 Shopify에 전달)
  if (shopifyOptions.length > 0) {
    shopifyProduct.options = shopifyOptions;
  }

  return shopifyProduct;
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

    // 2. 카테고리 매칭 (아마존 → Shopify Taxonomy)
    let shopifyCategoryId: string | undefined = undefined;
    let shopifyCategoryName: string | undefined = undefined;
    
    if (product.category) {
      const { matchCategoryToShopify } = await import("@/lib/utils/category-matcher");
      const matchResult = await matchCategoryToShopify(product.category);
      
      if (matchResult.success && matchResult.shopifyCategoryId) {
        shopifyCategoryId = matchResult.shopifyCategoryId;
        shopifyCategoryName = matchResult.shopifyCategoryName;
        console.log(`✅ 카테고리 매칭 성공: ${matchResult.shopifyCategoryName} (신뢰도: ${matchResult.confidence?.toFixed(2)})`);
      } else {
        console.warn(`⚠️  카테고리 매칭 실패: ${matchResult.error || "알 수 없는 오류"}`);
      }
    }

    // 3. 상품 데이터 변환
    const shopifyProduct = formatProductForShopify(product, shopifyCategoryId, shopifyCategoryName);
    console.log("📦 변환된 상품 데이터:", {
      title: shopifyProduct.title,
      price: shopifyProduct.variants?.[0]?.price,
      images: shopifyProduct.images?.length,
      category: shopifyCategoryName || "미매칭",
      product_type: shopifyProduct.product_type,
    });

    // 4. API 요청 함수 정의 (REST API)
    const makeRequest = async () => {
      // URL 정리 (https:// 제거, 나중에 추가)
      let storeUrl = process.env.SHOPIFY_STORE_URL || "";
      storeUrl = storeUrl.replace(/^https?:\/\//, "");
      
      const url = `https://${storeUrl}/admin/api/${process.env.SHOPIFY_API_VERSION}/products.json`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product: shopifyProduct }),
      });

      // Content-Type 확인 (JSON이 아니면 에러)
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text();
        console.error("❌ JSON이 아닌 응답:", textResponse.substring(0, 200));
        return {
          success: false,
          error: `Invalid response: Expected JSON but got ${contentType}. Check SHOPIFY_STORE_URL and access token.`,
          statusCode: response.status,
        };
      }

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
      
      // 카테고리 매칭 정보 로그
      if (shopifyCategoryName) {
        console.log(`📝 매칭된 Shopify 카테고리가 product_type에 설정됨: ${shopifyProduct.product_type}`);
      } else {
        console.log(`📝 기본 카테고리가 product_type에 설정됨: ${shopifyProduct.product_type}`);
      }
      
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

