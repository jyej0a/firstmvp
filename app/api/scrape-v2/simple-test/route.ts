/**
 * @file app/api/scrape-v2/simple-test/route.ts
 * @description 간단한 더미 테스트 API (Job ID 없이)
 *
 * Job ID 없이 간단하게 수집 → 저장 → Shopify 등록이 잘 되는지 테스트
 * 동기식 응답으로 바로 결과 확인 가능
 *
 * Endpoint: POST /api/scrape-v2/simple-test
 *
 * Request Body:
 * {
 *   "count": number (선택사항, 기본값: 3)
 * }
 *
 * Response:
 * {
 *   "success": boolean,
 *   "data": {
 *     "saved": number,
 *     "failed": number,
 *     "products": Product[]
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { saveProductsToDatabase } from "@/lib/utils/save-products";
import { createProduct } from "@/lib/shopify/client";
import type { ApiResponse, ScrapedProductRaw, Product } from "@/types";

/**
 * 더미 상품 데이터 생성
 */
function generateDummyProduct(index: number): ScrapedProductRaw {
  const dummyTitles = [
    "Wireless Phone Stand with Adjustable Height",
    "Ergonomic Laptop Stand for Desk",
    "Portable Phone Mount for Car Dashboard",
    "Multi-Angle Tablet Stand Holder",
    "Desktop Monitor Stand with Storage",
  ];

  const dummyImages = [
    "https://m.media-amazon.com/images/I/71abc123def._AC_SL1500_.jpg",
    "https://m.media-amazon.com/images/I/72bcd456efg._AC_SL1500_.jpg",
    "https://m.media-amazon.com/images/I/73cde567fgh._AC_SL1500_.jpg",
  ];

  const title = dummyTitles[index % dummyTitles.length];
  const asin = `TEST${String(index + 1).padStart(6, "0")}`;
  const price = 19.99 + (index % 10) * 5; // $19.99 ~ $64.99

  return {
    asin,
    title: `${title} (Test ${index + 1})`,
    images: dummyImages,
    amazonPrice: price,
    sourceUrl: `https://www.amazon.com/dp/${asin}`,
    description: `This is a test product #${index + 1} for simple testing.`,
    category: "Electronics",
  };
}

/**
 * POST 요청 핸들러
 * 간단한 더미 테스트 (Job ID 없이)
 */
export async function POST(request: NextRequest) {
  console.group("🧪 [Simple Test] 간단한 더미 테스트 시작");

  try {
    // 1. 사용자 인증 확인
    const { userId } = await auth();

    if (!userId) {
      console.error("❌ 인증되지 않은 사용자");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "인증이 필요합니다.",
        } satisfies ApiResponse,
        { status: 401 }
      );
    }

    console.log(`👤 사용자 ID: ${userId}`);

    // 2. 요청 바디 파싱
    const body = await request.json();
    const { count = 3 } = body; // 기본값: 3개

    console.log(`🎯 테스트 개수: ${count}개`);

    // 3. 개수 검증
    if (typeof count !== "number" || count <= 0 || count > 10) {
      console.error("❌ 유효하지 않은 개수");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "개수는 1 이상 10 이하여야 합니다.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    // 4. 더미 상품 생성
    console.log(`📦 ${count}개 더미 상품 생성 중...`);
    const dummyProducts: ScrapedProductRaw[] = [];
    for (let i = 0; i < count; i++) {
      dummyProducts.push(generateDummyProduct(i));
    }

    console.log(`✅ 더미 상품 생성 완료`);

    // 5. 금지어 필터링
    console.log(`🚫 금지어 필터링 중...`);
    const { filterByBannedKeywords } = await import("@/lib/utils/filter-banned-keywords");
    const filterResult = await filterByBannedKeywords(dummyProducts);
    
    console.log(`✅ 필터링 완료: ${filterResult.stats.passed}개 통과, ${filterResult.stats.filteredOut}개 제외`);

    // 6. DB 저장
    console.log(`💾 DB 저장 중...`);
    const saveResult = await saveProductsToDatabase(filterResult.filteredProducts, userId);
    
    console.log(`✅ DB 저장 완료: ${saveResult.saved}개 저장, ${saveResult.failed}개 실패`);

    // 7. 저장된 상품 조회
    const savedProducts: Product[] = [];
    if (saveResult.saved > 0) {
      const savedAsins = filterResult.filteredProducts
        .slice(0, saveResult.saved)
        .map((p) => p.asin);

      const { data: products } = await supabase
        .from("products")
        .select("*")
        .in("asin", savedAsins)
        .eq("user_id", userId);

      if (products) {
        // DB 데이터를 Product 타입으로 변환
        for (const productRow of products) {
          savedProducts.push({
            id: productRow.id,
            userId: productRow.user_id,
            asin: productRow.asin,
            sourceUrl: productRow.source_url,
            title: productRow.title,
            description: productRow.description,
            images: productRow.images,
            variants: productRow.variants,
            category: productRow.category || "General",
            reviewCount: productRow.review_count ?? null,
            rating: productRow.rating ?? null,
            brand: productRow.brand ?? null,
            weight: productRow.weight ? Number(productRow.weight) : null,
            sourcingType: productRow.sourcing_type as "US" | "CN",
            amazonPrice: Number(productRow.amazon_price),
            costPrice: productRow.cost_price ? Number(productRow.cost_price) : null,
            shippingCost: productRow.shipping_cost ? Number(productRow.shipping_cost) : null,
            extraCost: productRow.extra_cost ? Number(productRow.extra_cost) : null,
            marginRate: Number(productRow.margin_rate),
            sellingPrice: Number(productRow.selling_price),
            status: productRow.status as "draft" | "uploaded" | "error",
            errorMessage: productRow.error_message,
            createdAt: productRow.created_at,
            updatedAt: productRow.updated_at,
          });
        }
      }
    }

    // 8. Shopify 등록 (선택사항 - 주석 처리)
    // 실제 Shopify 등록을 테스트하려면 아래 주석 해제
    /*
    console.log(`🛒 Shopify 등록 중...`);
    let shopifySuccess = 0;
    let shopifyFailed = 0;
    
    for (const product of savedProducts) {
      try {
        const result = await createProduct(product);
        if (result.success) {
          shopifySuccess++;
        } else {
          shopifyFailed++;
        }
      } catch (err) {
        console.error(`Shopify 등록 실패 (${product.asin}):`, err);
        shopifyFailed++;
      }
    }
    console.log(`✅ Shopify 등록 완료: ${shopifySuccess}개 성공, ${shopifyFailed}개 실패`);
    */

    console.log(`\n✅ 간단한 테스트 완료!`);
    console.log(`   - 생성: ${count}개`);
    console.log(`   - 필터링 통과: ${filterResult.stats.passed}개`);
    console.log(`   - DB 저장: ${saveResult.saved}개`);
    console.log(`   - 실패: ${saveResult.failed}개`);
    console.groupEnd();

    // 9. 결과 반환
    return NextResponse.json(
      {
        success: true,
        data: {
          saved: saveResult.saved,
          failed: saveResult.failed,
          products: savedProducts,
        },
        message: `${saveResult.saved}개 상품이 성공적으로 저장되었습니다.`,
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 간단한 테스트 중 오류:", error);
    console.groupEnd();

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

