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
 * - version: string (optional, default: 'v2') - 'v1' 또는 'v2' (조회할 테이블 선택)
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
    const status = searchParams.get("status"); // status 필터링 추가
    const jobId = searchParams.get("jobId"); // jobId 필터링 추가 (현재 Job에 속한 상품만 조회)
    const version = searchParams.get("version") || "v2"; // V1/V2 구분 (기본값: v2)
    const todayKst = searchParams.get("todayKst") === "true"; // 오늘(KST) 필터링

    // version 검증
    if (version !== "v1" && version !== "v2") {
      console.error("❌ 유효하지 않은 version 파라미터");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "version 파라미터는 'v1' 또는 'v2'여야 합니다.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // V1에서는 jobId 필터링 불가 (V2 전용 기능)
    if (version === "v1" && jobId) {
      console.warn("⚠️  V1에서는 jobId 필터링을 지원하지 않습니다.");
    }

    const tableName = version === "v1" ? "products_v1" : "products_v2";
    console.log(
      `📊 조회 조건: version=${version}, table=${tableName}, limit=${limit}, offset=${offset}, status=${status || "all"}, jobId=${jobId || "all"}, todayKst=${todayKst}`
    );

    // 3. Supabase 클라이언트 생성
    const supabase = getServiceRoleClient();

    // 4. jobId 필터링: 현재 Job에 속한 product_id 목록 조회 (V2 전용)
    let jobProductIds: string[] | null = null;
    if (version === "v2" && jobId) {
      const { data: jobItems, error: jobItemsError } = await supabase
        .from("scraping_job_items")
        .select("product_id")
        .eq("job_id", jobId)
        .not("product_id", "is", null);

      if (jobItemsError) {
        console.error("❌ Job Items 조회 실패:", jobItemsError);
        console.groupEnd();

        return NextResponse.json(
          {
            success: false,
            error: "Job 상품 목록을 조회하는 중 오류가 발생했습니다.",
          } satisfies ApiResponse,
          { status: 500 }
        );
      }

      jobProductIds = jobItems?.map((item) => item.product_id).filter((id): id is string => id !== null) || [];
      console.log(`📋 Job에 속한 상품 ID 개수: ${jobProductIds.length}개`);
    }

    // 5. 쿼리 빌더 생성 (version에 따라 테이블 선택)
    let countQuery = supabase
      .from(tableName)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    let dataQuery = supabase
      .from(tableName)
      .select("*")
      .eq("user_id", userId);

    // 6.5 오늘(KST) 필터링 적용 (KST 00:00~익일 00:00 범위)
    if (todayKst) {
      const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
      const nowUtc = new Date();

      // UTC 기반으로 KST 날짜를 만든 뒤, KST 자정을 계산 (timezone 영향을 피하려고 UTC API 사용)
      const kstNow = new Date(nowUtc.getTime() + KST_OFFSET_MS);
      kstNow.setUTCHours(0, 0, 0, 0); // KST 기준 00:00

      const startUtc = new Date(kstNow.getTime() - KST_OFFSET_MS);
      const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

      const startIso = startUtc.toISOString();
      const endIso = endUtc.toISOString();

      console.log(`📅 오늘(KST) 필터 적용: created_at >= ${startIso} AND < ${endIso}`);

      countQuery = countQuery.gte("created_at", startIso).lt("created_at", endIso);
      dataQuery = dataQuery.gte("created_at", startIso).lt("created_at", endIso);
    }

    // 6. jobId 필터링 적용 (V2 전용, 현재 Job에 속한 상품만 조회)
    if (version === "v2" && jobId) {
      if (jobProductIds && jobProductIds.length > 0) {
      countQuery = countQuery.in("id", jobProductIds);
      dataQuery = dataQuery.in("id", jobProductIds);
      } else {
      // Job이 있지만 아직 상품이 없는 경우 빈 결과 반환
      console.log("📋 Job에 속한 상품이 아직 없습니다.");
      return NextResponse.json(
        {
          success: true,
          data: {
            products: [],
            total: 0,
            limit,
            offset,
          },
          message: "아직 수집된 상품이 없습니다.",
        } satisfies ApiResponse,
        { status: 200 }
      );
      }
    }

    // 7. status 필터링 적용
    if (status) {
      countQuery = countQuery.eq("status", status);
      dataQuery = dataQuery.eq("status", status);
    }

    // 8. 전체 개수 조회 (페이지네이션용)
    const { count, error: countError } = await countQuery;

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

    // 9. 상품 목록 조회
    const { data, error } = await dataQuery
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

    // 10. DB 데이터를 Product 타입으로 변환 (snake_case → camelCase)
    const products: Product[] = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      asin: row.asin,
      sourceUrl: row.source_url,
      title: row.title,
      description: row.description,
      images: row.images,
      variants: row.variants,
      category: row.category || 'General', // V2 전용
      reviewCount: row.review_count ?? null, // V2 전용
      rating: row.rating ?? null, // V2 전용
      brand: row.brand ?? null, // V2 전용
      weight: row.weight ?? null, // V2 전용
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

    // 11. 성공 응답
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
