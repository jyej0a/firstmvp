/**
 * @file lib/utils/save-products.ts
 * @description 상품 DB 저장 유틸리티
 *
 * 이 파일은 스크래핑된 상품을 Supabase products 테이블에 저장하는 기능을 제공합니다.
 *
 * 주요 기능:
 * 1. Clerk 사용자 인증 및 user_id 추출
 * 2. 필터링된 상품을 DB에 일괄 저장
 * 3. 중복 ASIN 처리 (ON CONFLICT UPDATE)
 * 4. 저장 성공/실패 통계 반환
 *
 * @see {@link /docs/PRD.md} - 상품 데이터 구조
 * @see {@link /supabase/migrations/20241204000000_create_products_table.sql} - products 테이블 스키마
 */

import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { ScrapedProductRaw } from "@/types";

/**
 * DB 저장 결과 인터페이스
 */
export interface SaveResult {
  /** 저장된 상품 개수 */
  saved: number;

  /** 저장 실패한 상품 개수 */
  failed: number;

  /** 전체 시도한 개수 */
  total: number;

  /** 실패한 상품 목록 (디버깅용) */
  errors: Array<{
    asin: string;
    title: string;
    error: string;
  }>;
}

/**
 * 판매 가격 계산 함수
 * 
 * US 타입: amazonPrice × (1 + marginRate/100)
 * 
 * @param amazonPrice - 아마존 가격
 * @param marginRate - 마진율 (기본 40%)
 * @returns 최종 판매 가격 (소수점 2자리)
 */
function calculateSellingPrice(
  amazonPrice: number,
  marginRate: number = 40
): number {
  const price = amazonPrice * (1 + marginRate / 100);
  return Math.round(price * 100) / 100; // 소수점 2자리
}

/**
 * 상품 데이터를 DB에 저장하는 메인 함수
 *
 * @param products - 저장할 상품 배열 (필터링된 상품)
 * @param userId - 사용자 ID (선택사항, 제공되지 않으면 auth() 사용)
 * @param tableName - 테이블명 (기본값: 'products_v1', V2는 'products_v2' 사용)
 * @returns 저장 결과 (성공/실패 통계)
 *
 * @example
 * // V1 사용
 * const result = await saveProductsToDatabase(filteredProducts, userId, 'products_v1');
 * 
 * // V2 사용
 * const result = await saveProductsToDatabase(filteredProducts, userId, 'products_v2');
 */
export async function saveProductsToDatabase(
  products: ScrapedProductRaw[],
  userId?: string,
  tableName: 'products_v1' | 'products_v2' = 'products_v1'
): Promise<SaveResult> {
  console.group("💾 DB 저장 시작");
  const startTime = Date.now();

  // 1. 사용자 ID 확인
  let finalUserId = userId;
  if (!finalUserId) {
    const authResult = await auth();
    finalUserId = authResult.userId;

    if (!finalUserId) {
      console.error("❌ 인증되지 않은 사용자");
      console.groupEnd();
      throw new Error("User not authenticated");
    }
  }

  console.log(`👤 사용자 ID: ${finalUserId}`);
  console.log(`📊 저장 대상: ${products.length}개 상품`);

  // 2. Service Role 클라이언트 생성
  const supabase = getServiceRoleClient();

  // 3. 저장 결과 초기화
  const result: SaveResult = {
    saved: 0,
    failed: 0,
    total: products.length,
    errors: [],
  };

  // 4. 각 상품을 개별적으로 저장 (에러 발생 시에도 계속 진행)
  for (const product of products) {
    try {
      // 가격 유효성 검증 (0 이하는 저장 불가)
      if (product.amazonPrice <= 0) {
        console.warn(`   ⚠️  가격 오류로 건너뜀: ${product.title} (${product.asin})`);
        console.warn(`      아마존 가격: $${product.amazonPrice}`);
        result.failed++;
        result.errors.push({
          asin: product.asin,
          title: product.title,
          error: `Invalid price: $${product.amazonPrice}`,
        });
        continue; // 다음 상품으로 건너뜀
      }

      // 판매 가격 계산 (기본 마진율 40%)
      const sellingPrice = calculateSellingPrice(product.amazonPrice, 40);

      // variants 처리: string[] -> JSONB
      const variantsJson = product.variants
        ? { options: product.variants }
        : null;

      // DB에 저장 (UPSERT) - ASIN만 unique 제약 사용
      const { error } = await supabase.from(tableName).upsert(
        {
          user_id: finalUserId,
          asin: product.asin,
          source_url: product.sourceUrl,
          title: product.title,
          description: product.description || null,
          images: product.images,
          variants: variantsJson,
          sourcing_type: "US", // 기본값: US 타입
          amazon_price: product.amazonPrice,
          margin_rate: 40, // 기본 마진율 40%
          selling_price: sellingPrice,
          status: "draft", // 초기 상태: draft
          error_message: null,
          category: product.category || 'General', // V1: 카테고리 필드 추가
          // 추가 필드들 (nullable, 스크래핑 시 수집한 경우에만 저장)
          review_count: product.reviewCount ?? null,
          rating: product.rating ?? null,
          brand: product.brand ?? null,
          weight: product.weight ?? null,
        },
        {
          onConflict: "asin", // ASIN이 중복되면 업데이트
          ignoreDuplicates: false, // 중복 시 업데이트 실행
        }
      );

      if (error) {
        console.error(`   ❌ 저장 실패: ${product.title} (${product.asin})`);
        console.error(`      에러: ${error.message}`);
        result.failed++;
        result.errors.push({
          asin: product.asin,
          title: product.title,
          error: error.message,
        });
      } else {
        result.saved++;
      }
    } catch (err) {
      console.error(`   ❌ 예외 발생: ${product.title} (${product.asin})`);
      console.error(`      에러:`, err);
      result.failed++;
      result.errors.push({
        asin: product.asin,
        title: product.title,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const duration = Date.now() - startTime;

  console.log("\n==================================================");
  console.log("✅ DB 저장 완료");
  console.log(`📊 전체: ${result.total}개`);
  console.log(`✅ 성공: ${result.saved}개`);
  console.log(`❌ 실패: ${result.failed}개`);
  console.log(`⏱️  소요 시간: ${duration}ms`);

  if (result.errors.length > 0) {
    console.log("\n❌ 실패한 상품 목록:");
    result.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.title} (${error.asin})`);
      console.log(`      에러: ${error.error}`);
    });
  }

  console.log("==================================================");
  console.groupEnd();

  return result;
}

