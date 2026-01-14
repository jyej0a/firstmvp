/**
 * @file app/api/test/category-match/route.ts
 * @description 카테고리 매칭 테스트 API 엔드포인트
 *
 * 이 API는 카테고리 매칭 시스템을 테스트하기 위한 엔드포인트입니다.
 * GET 요청으로 아마존 카테고리를 전달하면 쇼피파이 카테고리 매칭 결과를 반환합니다.
 *
 * @example
 * GET /api/test/category-match?category=Electronics%20%3E%20Computers%20%3E%20Laptops
 */

import { NextRequest, NextResponse } from "next/server";
import { matchCategoryToShopify } from "@/lib/utils/category-matcher";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: "카테고리 파라미터가 필요합니다. ?category=Electronics%20%3E%20Computers 형식으로 전달하세요.",
        },
        { status: 400 }
      );
    }

    console.log(`🔍 카테고리 매칭 테스트 시작: ${category}`);

    // 카테고리 매칭 실행
    const result = await matchCategoryToShopify(category);

    return NextResponse.json({
      input: category,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ 카테고리 매칭 테스트 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}

