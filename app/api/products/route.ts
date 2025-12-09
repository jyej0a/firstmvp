/**
 * @file app/api/products/route.ts
 * @description 상품 목록 조회 API Route
 *
 * 이 API는 현재 로그인한 사용자가 저장한 상품 목록을 조회합니다.
 *
 * Endpoint: GET /api/products
 *
 * Query Parameters:
 * - limit: number (optional, default: 50) - 조회할 상품 개수
 * - offset: number (optional, default: 0) - 페이지네이션 오프셋
 *
 * Response:
 * {
 *   "success": boolean,
 *   "data": {
 *     "products": Product[],
 *     "total": number,
 *     "limit": number,
 *     "offset": number
 *   },
 *   "message": string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { ApiResponse, Product } from "@/types";

/**
 * GET 요청 핸들러
 * 현재 사용자의 상품 목록 조회
 */
export async function GET(request: NextRequest) {
  console.group("📋 [API] 상품 목록 조회 요청");

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

    // 2. 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    console.log(`📊 조회 조건: limit=${limit}, offset=${offset}`);

    // 3. Supabase 클라이언트 생성
    const supabase = getServiceRoleClient();

    // 4. 전체 개수 조회 (페이지네이션용)
    const { count, error: countError } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      console.error("❌ 개수 조회 실패:", countError);
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "상품 개수를 조회하는 중 오류가 발생했습니다.",
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    const total = count || 0;
    console.log(`📦 총 상품 개수: ${total}개`);

    // 5. 상품 목록 조회
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("❌ DB 조회 실패:", error);
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "상품 목록을 조회하는 중 오류가 발생했습니다.",
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    // 6. DB 데이터를 Product 타입으로 변환 (snake_case → camelCase)
    const products: Product[] = (data || []).map((row: any) => ({
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
    }));

    console.log(`✅ ${products.length}개 상품 조회 완료`);
    console.groupEnd();

    // 7. 성공 응답
    return NextResponse.json(
      {
        success: true,
        data: {
          products,
          total,
          limit,
          offset,
        },
        message: `${products.length}개의 상품을 조회했습니다.`,
      } satisfies ApiResponse,
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
