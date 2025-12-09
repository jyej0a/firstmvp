/**
 * @file app/api/scrape/route.ts
 * @description 아마존 상품 스크래핑 API Route
 *
 * 이 API는 사용자가 입력한 키워드 또는 URL을 받아
 * 아마존 상품 정보를 스크래핑하여 반환합니다.
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
 *       "duration": number,
 *       "pagesScraped": number
 *     }
 *   },
 *   "message": string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { processSearchInput } from "@/lib/utils/url-processor";
import { scrapeAmazonProducts } from "@/lib/scraper/amazon-scraper";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limiter";
import { filterByBannedKeywords } from "@/lib/utils/filter-banned-keywords";
import { saveProductsToDatabase } from "@/lib/utils/save-products";
import type { ApiResponse } from "@/types";

/**
 * POST 요청 핸들러
 * 아마존 상품 스크래핑 실행
 */
export async function POST(request: NextRequest) {
  console.group("🔥 [API] 스크래핑 요청 수신");
  const startTime = Date.now();

  try {
    // 1. Rate Limiting 체크 (Bot Detection 대응)
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

    // 2. 요청 바디 파싱
    const body = await request.json();
    const { searchInput } = body;

    console.log(`📝 입력값: "${searchInput}"`);

    // 2. 입력값 검증
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

    // 3. URL 처리 (키워드 → Amazon URL 변환 또는 URL 검증)
    console.log("🔄 URL 처리 중...");
    let processedUrl: string;

    try {
      const processed = processSearchInput(searchInput);
      processedUrl = processed.url;
      console.log(`✅ 처리 완료 (타입: ${processed.type})`);
      console.log(`   URL: ${processedUrl}`);
    } catch (urlError) {
      console.error("❌ URL 처리 실패:", urlError);
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error:
            urlError instanceof Error
              ? urlError.message
              : "URL 처리 중 오류가 발생했습니다.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // 4. 스크래핑 실행
    console.log("🚀 스크래핑 시작...");
    try {
      const result = await scrapeAmazonProducts(processedUrl, {
        maxProducts: 30,
        timeout: 60000, // 60초 타임아웃
        headless: true,
        verbose: false,
      });

      const duration = Date.now() - startTime;
      console.log(`✅ 스크래핑 완료 (${duration}ms)`);
      console.log(`   수집 상품: ${result.totalScraped}개`);
      console.log(`   수집 페이지: ${result.pagesScraped}페이지`);

      // 5. 금지어 필터링
      console.log("\n🔍 금지어 필터링 실행...");
      const filterResult = await filterByBannedKeywords(result.products);

      console.log(`✅ 필터링 완료`);
      console.log(`   필터링 전: ${filterResult.stats.total}개`);
      console.log(`   필터링 후: ${filterResult.stats.passed}개`);
      console.log(`   제거됨: ${filterResult.stats.filteredOut}개`);

      // 6. DB 저장
      console.log("\n💾 DB 저장 실행...");
      const saveResult = await saveProductsToDatabase(
        filterResult.filteredProducts
      );

      console.log(`✅ DB 저장 완료`);
      console.log(`   저장 성공: ${saveResult.saved}개`);
      console.log(`   저장 실패: ${saveResult.failed}개`);
      console.groupEnd();

      // 7. 성공 응답
      const message = (() => {
        const parts: string[] = [];

        // 수집 결과
        parts.push(`${result.totalScraped}개 스크래핑`);

        // 필터링 결과
        if (filterResult.stats.filteredOut > 0) {
          parts.push(`${filterResult.stats.filteredOut}개 필터링`);
        }

        // 저장 결과
        parts.push(`${saveResult.saved}개 저장 완료`);

        if (saveResult.failed > 0) {
          parts.push(`${saveResult.failed}개 저장 실패`);
        }

        return parts.join(", ");
      })();

      return NextResponse.json(
        {
          success: true,
          data: {
            products: filterResult.filteredProducts,
            stats: {
              totalScraped: result.totalScraped,
              filteredOut: filterResult.stats.filteredOut,
              saved: saveResult.saved,
              failed: saveResult.failed,
              finalCount: saveResult.saved,
              duration: result.duration,
              pagesScraped: result.pagesScraped,
            },
          },
          message,
        } satisfies ApiResponse,
        { status: 200 }
      );
    } catch (scrapeError) {
      console.error("❌ 스크래핑 실패:", scrapeError);
      console.groupEnd();

      // 스크래핑 에러 타입별 처리
      if (scrapeError instanceof Error) {
        // Timeout 에러
        if (scrapeError.message.includes("timeout")) {
          return NextResponse.json(
            {
              success: false,
              error:
                "요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
            } satisfies ApiResponse,
            { status: 408 }
          );
        }

        // Network 에러
        if (
          scrapeError.message.includes("network") ||
          scrapeError.message.includes("ERR_")
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.",
            } satisfies ApiResponse,
            { status: 503 }
          );
        }

        // Amazon 접근 차단 (Bot Detection)
        if (
          scrapeError.message.includes("blocked") ||
          scrapeError.message.includes("captcha")
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "일시적으로 Amazon 접근이 제한되었습니다. 잠시 후 다시 시도해 주세요.",
            } satisfies ApiResponse,
            { status: 503 }
          );
        }

        // 일반 에러
        return NextResponse.json(
          {
            success: false,
            error: `스크래핑 중 오류가 발생했습니다: ${scrapeError.message}`,
          } satisfies ApiResponse,
          { status: 500 }
        );
      }

      // 알 수 없는 에러
      return NextResponse.json(
        {
          success: false,
          error: "알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.",
        } satisfies ApiResponse,
        { status: 500 }
      );
    }
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

/**
 * GET 요청 핸들러
 * API 정보 반환 (문서화 목적)
 */
export async function GET() {
  return NextResponse.json(
    {
      success: true,
      message: "아마존 상품 스크래핑 API",
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
            products: "ScrapedProductRaw[]",
            stats: {
              totalScraped: "number",
              duration: "number (ms)",
              pagesScraped: "number",
            },
          },
          message: "string",
        },
      },
    },
    { status: 200 }
  );
}

