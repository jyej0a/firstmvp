/**
 * @file app/api/scrape-v2/route.ts
 * @description 아마존 상품 스크래핑 API Route (V2: 순차 처리)
 *
 * V2: 순차 처리 스크래핑
 * - 1분당 1개씩 순차 수집
 * - 비동기 Job 시작 → 즉시 응답 (202 Accepted)
 * - 진행 상황은 /api/scrape-v2/[jobId]로 조회
 *
 * Endpoint: POST /api/scrape-v2
 *
 * Request Body:
 * {
 *   "searchInput": string (키워드 또는 Amazon URL)
 *   "totalTarget": number (선택사항, 기본값: 1000, 최대: 1000)
 * }
 *
 * Response:
 * {
 *   "success": boolean,
 *   "data": {
 *     "jobId": string (Job ID, 진행 상황 조회에 사용),
 *     "message": string
 *   },
 *   "message": string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limiter";
import { startSequentialScraping } from "@/lib/scraper/sequential-scraper";
import type { ApiResponse } from "@/types";

/**
 * POST 요청 핸들러
 * 순차 처리 스크래핑 Job 시작
 */
export async function POST(request: NextRequest) {
  console.group("🔥 [API] 순차 처리 스크래핑 요청 수신 (V2)");

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
    const { searchInput, totalTarget, scrapingMode } = body;

    console.log(`📝 입력값: "${searchInput}"`);
    if (totalTarget) {
      console.log(`🎯 목표 개수: ${totalTarget}개`);
    }
    if (scrapingMode) {
      console.log(`📝 수집 모드: ${scrapingMode}`);
    }

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

    // 5. 목표 개수 검증
    if (totalTarget !== undefined) {
      if (typeof totalTarget !== "number" || totalTarget <= 0 || totalTarget > 1000) {
        console.error("❌ 유효하지 않은 목표 개수");
        console.groupEnd();

        return NextResponse.json(
          {
            success: false,
            error: "목표 개수는 1 이상 1000 이하여야 합니다.",
          } satisfies ApiResponse,
          { status: 400 }
        );
      }
    }

    // 6. 순차 처리 Job 시작
    console.log("🚀 순차 처리 Job 시작...");
    try {
      const jobId = await startSequentialScraping({
        userId,
        searchInput,
        totalTarget: totalTarget || 1000,
        scrapingMode: scrapingMode || "collect_sync",
      });

      console.log(`✅ Job 시작 완료: ${jobId}`);
      console.groupEnd();

      // 7. 즉시 응답 (202 Accepted)
      return NextResponse.json(
        {
          success: true,
          data: {
            jobId,
            message: "순차 처리 작업이 시작되었습니다.",
          },
          message: "수집 작업이 시작되었습니다. 진행 상황을 확인하세요.",
        } satisfies ApiResponse,
        { status: 202 }
      );
    } catch (jobError) {
      console.error("❌ Job 시작 실패:", jobError);
      console.groupEnd();

      if (jobError instanceof Error) {
        return NextResponse.json(
          {
            success: false,
            error: `작업 시작 실패: ${jobError.message}`,
          } satisfies ApiResponse,
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "작업 시작 중 오류가 발생했습니다.",
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
      message: "순차 처리 스크래핑 API (V2)",
      usage: {
        method: "POST",
        endpoint: "/api/scrape-v2",
        body: {
          searchInput:
            "string (키워드 또는 Amazon URL, 예: 'phone stand' 또는 'https://amazon.com/s?k=...')",
          totalTarget: "number (선택사항, 기본값: 1000, 최대: 1000)",
        },
        response: {
          success: "boolean",
          data: {
            jobId: "string (Job ID, 진행 상황 조회에 사용)",
            message: "string",
          },
          message: "string",
        },
        status: "202 Accepted (작업이 백그라운드에서 시작됨)",
      },
      progress: {
        endpoint: "GET /api/scrape-v2/[jobId]",
        description: "Job ID로 진행 상황 조회",
      },
    },
    { status: 200 }
  );
}

