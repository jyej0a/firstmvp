/**
 * @file app/api/scrape/route.ts
 * @description 아마존 상품 스크래핑 API Route (V1: 일괄 수집)
 *
 * V1: 일괄 수집 모드
 * - 30개 상품을 한번에 수집
 * - 동기식 응답 (수집 완료 후 결과 반환)
 *
 * Endpoint: POST /api/scrape
 *
 * Request Body:
 * {
 *   "searchInput": string (키워드 또는 Amazon URL)
 * }
 *
 * Response:
 * {
 *   "success": boolean,
 *   "data": {
 *     "products": ScrapedProductRaw[],
 *     "stats": {
 *       "totalScraped": number,
 *       "saved": number,
 *       "failed": number,
 *       "duration": number,
 *       "pagesScraped": number
 *     }
 *   },
 *   "message": string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limiter";
import { scrapeAmazonProducts } from "@/lib/scraper/amazon-scraper";
import { filterByBannedKeywords } from "@/lib/utils/filter-banned-keywords";
import { saveProductsToDatabase } from "@/lib/utils/save-products";
import type { ApiResponse } from "@/types";

/**
 * POST 요청 핸들러
 * 일괄 수집 스크래핑 (30개 한번에)
 */
export async function POST(request: NextRequest) {
  console.group("🔥 [API] 일괄 수집 스크래핑 요청 수신");

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

    // 2. Rate Limiting 체크 (Bot Detection 대응)
    const clientIp = getClientIp(request);
    console.log(`🌐 클라이언트 IP: ${clientIp}`);

    const rateLimitResult = checkRateLimit(clientIp);
    if (!rateLimitResult.allowed) {
      console.warn(`⚠️  Rate Limit 초과 (${clientIp})`);
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: rateLimitResult.reason || "요청이 너무 많습니다.",
          retryAfter: rateLimitResult.retryAfter,
        } satisfies ApiResponse,
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfter || 60),
          },
        }
      );
    }

    // 3. 요청 바디 파싱
    const body = await request.json();
    const { searchInput } = body;

    console.log(`📝 입력값: "${searchInput}"`);

    // 4. 입력값 검증
    if (!searchInput || typeof searchInput !== "string") {
      console.error("❌ 유효하지 않은 입력값");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "검색어 또는 URL을 입력해 주세요.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // 5. URL 처리 (키워드 → Amazon URL 변환)
    const { processSearchInput } = await import("@/lib/utils/url-processor");
    const processed = processSearchInput(searchInput);
    const searchUrl = processed.url;

    console.log(`🔗 검색 URL: ${searchUrl}`);

    // 6. 일괄 수집 (30개) - V1: 영어 강제 설정으로 한글 상품명 방지
    console.log("🚀 일괄 수집 시작...");
    const scrapeResult = await scrapeAmazonProducts(searchUrl, {
      maxProducts: 30,
      verbose: true,
      forceEnglish: true, // V1 전용: 영어 강제 설정
    });

    console.log(`✅ 수집 완료: ${scrapeResult.products.length}개`);

    // 7. 금지어 필터링
    console.log("🚫 금지어 필터링 시작...");
    const filterResult = await filterByBannedKeywords(scrapeResult.products);
    console.log(`✅ 필터링 완료: ${filterResult.stats.filteredOut}개 제외, ${filterResult.stats.passed}개 통과`);

    // 8. DB 저장 (V1: products_v1 테이블 사용)
    console.log("💾 DB 저장 시작...");
    const saveResult = await saveProductsToDatabase(
      filterResult.filteredProducts,
      userId,
      'products_v1' // V1은 products_v1 테이블 사용
    );
    console.log(`✅ 저장 완료: ${saveResult.saved}개 저장, ${saveResult.failed}개 실패`);

    // 9. 결과 반환
    const result = {
      products: filterResult.filteredProducts,
      stats: {
        totalScraped: scrapeResult.totalScraped,
        filteredOut: filterResult.stats.filteredOut,
        saved: saveResult.saved,
        failed: saveResult.failed,
        duration: scrapeResult.duration,
        pagesScraped: scrapeResult.pagesScraped,
      },
    };

    console.log(`✅ 일괄 수집 완료!`);
    console.log(`   - 수집: ${result.stats.totalScraped}개`);
    console.log(`   - 필터링 제외: ${result.stats.filteredOut}개`);
    console.log(`   - 저장: ${result.stats.saved}개`);
    console.log(`   - 실패: ${result.stats.failed}개`);
    console.log(`   - 소요 시간: ${(result.stats.duration / 1000).toFixed(2)}초`);
        console.groupEnd();

      return NextResponse.json(
        {
          success: true,
        data: result,
        message: `${result.stats.saved}개 상품이 수집되고 저장되었습니다.`,
        } satisfies ApiResponse,
      { status: 200 }
      );
  } catch (error) {
    console.error("❌ API 처리 중 예상치 못한 오류:", error);
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

/**
 * GET 요청 핸들러
 * API 정보 반환 (문서화 목적)
 */
export async function GET() {
  return NextResponse.json(
    {
      success: true,
      message: "일괄 수집 스크래핑 API (V1)",
      usage: {
        method: "POST",
        endpoint: "/api/scrape",
        body: {
          searchInput:
            "string (키워드 또는 Amazon URL, 예: 'phone stand' 또는 'https://amazon.com/s?k=...')",
        },
        response: {
          success: "boolean",
          data: {
            products: "ScrapedProductRaw[] (수집된 상품 목록)",
            stats: {
              totalScraped: "number (수집된 총 개수)",
              filteredOut: "number (금지어로 제외된 개수)",
              saved: "number (DB에 저장된 개수)",
              failed: "number (저장 실패 개수)",
              duration: "number (소요 시간, 밀리초)",
              pagesScraped: "number (수집된 페이지 수)",
            },
          },
          message: "string",
        },
        status: "200 OK (동기식 응답, 수집 완료 후 결과 반환)",
      },
    },
    { status: 200 }
  );
}
