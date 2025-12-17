/**
 * @file app/api/scrape/[jobId]/route.ts
 * @description 스크래핑 Job 진행 상황 조회 API
 *
 * 이 API는 Job ID로 진행 상황을 조회합니다.
 *
 * Endpoint: GET /api/scrape/[jobId]
 *
 * Response:
 * {
 *   "success": boolean,
 *   "data": {
 *     "jobId": string,
 *     "status": "pending" | "running" | "completed" | "failed" | "cancelled",
 *     "currentCount": number,
 *     "totalTarget": number,
 *     "successCount": number,
 *     "failedCount": number,
 *     "estimatedTimeRemaining": number, // 초 단위
 *     "progressPercentage": number, // 0-100
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getJobProgress } from "@/lib/scraper/sequential-scraper";
import type { ApiResponse } from "@/types";

/**
 * GET 요청 핸들러
 * Job 진행 상황 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  console.group("📊 [API] Job 진행 상황 조회");

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

    // 2. Job ID 파라미터 추출
    const { jobId } = await params;
    console.log(`🔍 Job ID: ${jobId}`);

    if (!jobId) {
      console.error("❌ Job ID가 없습니다");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "Job ID가 필요합니다.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // 3. 진행 상황 조회
    const progress = await getJobProgress(jobId);

    if (!progress) {
      console.error("❌ Job을 찾을 수 없습니다");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "Job을 찾을 수 없습니다.",
        } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // 4. 사용자 권한 확인 (자신의 Job만 조회 가능)
    const { getJobInfo } = await import("@/lib/scraper/sequential-scraper");
    const jobInfo = await getJobInfo(jobId);

    if (!jobInfo) {
      console.error("❌ Job 정보를 찾을 수 없습니다");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "Job 정보를 찾을 수 없습니다.",
        } satisfies ApiResponse,
        { status: 404 }
      );
    }

    if (jobInfo.userId !== userId) {
      console.error("❌ 권한이 없습니다");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "이 Job에 대한 권한이 없습니다.",
        } satisfies ApiResponse,
        { status: 403 }
      );
    }

    console.log(`✅ 진행 상황 조회 완료`);
    console.log(`   상태: ${progress.status}`);
    console.log(`   진행률: ${progress.progressPercentage}% (${progress.currentCount}/${progress.totalTarget})`);
    console.log(`   예상 남은 시간: ${Math.ceil(progress.estimatedTimeRemaining / 60)}분`);
    console.groupEnd();

    // 5. 성공 응답
    return NextResponse.json(
      {
        success: true,
        data: progress,
        message: "진행 상황 조회 완료",
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 진행 상황 조회 중 오류:", error);
    console.groupEnd();

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "진행 상황 조회 중 오류가 발생했습니다.",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE 요청 핸들러
 * Job 취소
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  console.group("🛑 [API] Job 취소 요청");

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

    // 2. Job ID 파라미터 추출
    const { jobId } = await params;
    console.log(`🔍 Job ID: ${jobId}`);

    if (!jobId) {
      console.error("❌ Job ID가 없습니다");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "Job ID가 필요합니다.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // 3. 사용자 권한 확인 (자신의 Job만 취소 가능)
    const { getJobInfo, cancelJob } = await import("@/lib/scraper/sequential-scraper");
    const jobInfo = await getJobInfo(jobId);

    if (!jobInfo) {
      console.error("❌ Job을 찾을 수 없습니다");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "Job을 찾을 수 없습니다.",
        } satisfies ApiResponse,
        { status: 404 }
      );
    }

    if (jobInfo.userId !== userId) {
      console.error("❌ 권한이 없습니다");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "이 Job에 대한 권한이 없습니다.",
        } satisfies ApiResponse,
        { status: 403 }
      );
    }

    // 4. Job 취소
    const cancelled = await cancelJob(jobId);

    if (!cancelled) {
      console.error("❌ Job 취소 실패");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "Job 취소에 실패했습니다. 이미 완료되었거나 취소된 Job일 수 있습니다.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    console.log(`✅ Job 취소 완료`);
    console.groupEnd();

    // 5. 성공 응답
    return NextResponse.json(
      {
        success: true,
        message: "Job이 취소되었습니다.",
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Job 취소 중 오류:", error);
    console.groupEnd();

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Job 취소 중 오류가 발생했습니다.",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
