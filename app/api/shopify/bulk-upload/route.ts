/**
 * @file app/api/shopify/bulk-upload/route.ts
 * @description Shopify 일괄 등록 API
 *
 * 이 API는 체크박스로 선택된 상품들을 Shopify에 일괄 등록합니다.
 *
 * Endpoint: POST /api/shopify/bulk-upload
 *
 * Request Body:
 * {
 *   "product_ids": string[] - 등록할 상품 ID 배열
 * }
 *
 * Response:
 * {
 *   "success": boolean,
 *   "data": {
 *     "total": number,       // 총 시도 개수
 *     "success": number,     // 성공 개수
 *     "failed": number,      // 실패 개수
 *     "successIds": string[], // 성공한 상품 ID 목록
 *     "failures": Array<{    // 실패 상세 정보
 *       "productId": string,
 *       "asin": string,
 *       "error": string
 *     }>
 *   }
 * }
 *
 * @see {@link /docs/TODO.md#2.20} - 구현 계획
 * @see {@link /lib/shopify/client.ts} - Shopify API 클라이언트
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createProduct } from "@/lib/shopify/client";
import type { ApiResponse, ShopifyUploadResult, Product } from "@/types";

/**
 * 요청 바디 타입
 */
interface BulkUploadRequest {
  /** 등록할 상품 ID 배열 */
  product_ids: string[];
}

/**
 * 상품 검증
 * 
 * @param product - 검증할 상품
 * @returns 검증 결과 및 에러 메시지
 */
function validateProduct(product: any): { valid: boolean; error?: string } {
  // 필수 필드 확인
  if (!product.title || product.title.trim() === "") {
    return { valid: false, error: "상품명이 없습니다." };
  }

  if (!product.images || product.images.length === 0) {
    return { valid: false, error: "상품 이미지가 없습니다." };
  }

  if (!product.asin) {
    return { valid: false, error: "ASIN이 없습니다." };
  }

  // 판매가 검증
  if (product.selling_price <= 0) {
    return { valid: false, error: "판매가가 0 이하입니다." };
  }

  return { valid: true };
}

/**
 * DB 데이터를 Product 타입으로 변환
 * 
 * @param row - DB 레코드 (snake_case)
 * @returns Product 객체 (camelCase)
 */
function dbRowToProduct(row: any): Product {
  return {
    id: row.id,
    userId: row.user_id,
    asin: row.asin,
    sourceUrl: row.source_url,
    title: row.title,
    description: row.description,
    images: row.images,
    variants: row.variants,
    sourcingType: row.sourcing_type,
    amazonPrice: row.amazon_price,
    costPrice: row.cost_price,
    shippingCost: row.shipping_cost,
    extraCost: row.extra_cost,
    marginRate: row.margin_rate,
    sellingPrice: row.selling_price,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * POST 요청 핸들러 - 일괄 등록
 */
export async function POST(request: NextRequest) {
  console.group("🛒 [API] Shopify 일괄 등록 시작");

  try {
    // 1. Clerk 인증 확인
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
    let body: BulkUploadRequest;
    try {
      body = await request.json();
    } catch (err) {
      console.error("❌ 요청 바디 파싱 실패:", err);
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "잘못된 요청 형식입니다.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    const { product_ids } = body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      console.error("❌ product_ids가 유효하지 않음:", product_ids);
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "상품 ID 목록이 비어있거나 유효하지 않습니다.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    console.log(`📦 등록 요청: ${product_ids.length}개 상품`);

    // 3. Supabase 클라이언트 생성
    const supabase = getServiceRoleClient();

    // 4. 상품 조회
    const { data: productsData, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .in("id", product_ids)
      .eq("user_id", userId);

    if (fetchError) {
      console.error("❌ 상품 조회 실패:", fetchError);
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "상품 목록을 조회하는 중 오류가 발생했습니다.",
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    if (!productsData || productsData.length === 0) {
      console.error("❌ 조회된 상품 없음");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "선택한 상품을 찾을 수 없습니다.",
        } satisfies ApiResponse,
        { status: 404 }
      );
    }

    console.log(`✅ ${productsData.length}개 상품 조회 완료`);

    // 5. 결과 추적 변수
    const result: ShopifyUploadResult = {
      total: productsData.length,
      success: 0,
      failed: 0,
      successIds: [],
      failures: [],
    };

    // 6. 각 상품을 순차적으로 처리
    for (let i = 0; i < productsData.length; i++) {
      const productData = productsData[i];
      const product = dbRowToProduct(productData);

      console.log(`\n[${i + 1}/${productsData.length}] 처리 중: ${product.title.substring(0, 50)}...`);

      // 6-1. 상품 검증
      const validation = validateProduct(productData);
      if (!validation.valid) {
        console.error(`❌ 검증 실패: ${validation.error}`);

        result.failed++;
        result.failures.push({
          productId: product.id,
          asin: product.asin,
          error: validation.error || "유효하지 않은 상품 데이터",
        });

        // DB 상태 업데이트 (error)
        await supabase
          .from("products")
          .update({
            status: "error",
            error_message: validation.error,
            updated_at: new Date().toISOString(),
          })
          .eq("id", product.id);

        continue;
      }

      // 6-2. Shopify 등록 시도
      try {
        const uploadResult = await createProduct(product);

        if (uploadResult.success) {
          console.log(`✅ Shopify 등록 성공! Product ID: ${uploadResult.shopifyProductId}`);

          result.success++;
          result.successIds.push(product.id);

          // DB 상태 업데이트 (uploaded)
          await supabase
            .from("products")
            .update({
              status: "uploaded",
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", product.id);
        } else {
          console.error(`❌ Shopify 등록 실패: ${uploadResult.error}`);

          result.failed++;
          result.failures.push({
            productId: product.id,
            asin: product.asin,
            error: uploadResult.error || "Shopify 등록 실패",
          });

          // DB 상태 업데이트 (error)
          await supabase
            .from("products")
            .update({
              status: "error",
              error_message: uploadResult.error,
              updated_at: new Date().toISOString(),
            })
            .eq("id", product.id);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류";
        console.error(`❌ 예외 발생: ${errorMessage}`);

        result.failed++;
        result.failures.push({
          productId: product.id,
          asin: product.asin,
          error: errorMessage,
        });

        // DB 상태 업데이트 (error)
        await supabase
          .from("products")
          .update({
            status: "error",
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", product.id);
      }

      // Rate Limit 방지를 위한 짧은 딜레이 (선택 사항)
      // createProduct에 이미 재시도 로직이 있지만, 추가 안전장치
      if (i < productsData.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5초 대기
      }
    }

    // 7. 최종 결과 로그
    console.log("\n📊 일괄 등록 완료");
    console.log(`   - 총 시도: ${result.total}개`);
    console.log(`   - 성공: ${result.success}개`);
    console.log(`   - 실패: ${result.failed}개`);

    if (result.failures.length > 0) {
      console.log("\n❌ 실패 상세:");
      result.failures.forEach((failure, idx) => {
        console.log(`   ${idx + 1}. ASIN ${failure.asin}: ${failure.error}`);
      });
    }

    console.groupEnd();

    // 8. 성공 응답
    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `${result.success}개 상품이 성공적으로 등록되었습니다.`,
      } satisfies ApiResponse<ShopifyUploadResult>,
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ API 처리 중 예상치 못한 오류:", error);
    console.groupEnd();

    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
