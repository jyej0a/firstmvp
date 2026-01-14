/**
 * @file app/api/scrape-v2/[jobId]/route.ts
 * @description 스크래핑 Job 진행 상황 조회 API (V2)
 *
 * 이 API는 Job ID로 진행 상황을 조회합니다.
 *
 * Endpoint: GET /api/scrape-v2/[jobId]
 * Endpoint: DELETE /api/scrape-v2/[jobId] (Job 취소)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getJobProgress, getJobInfo, cancelJob, pauseJob, resumeJob, restartJob } from "@/lib/scraper/sequential-scraper";
import type { ApiResponse } from "@/types";

/**
 * GET 요청 핸들러
 * Job 진행 상황 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  console.group("📊 [API] Job 진행 상황 조회 (V2)");

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
    console.log(`   성공: ${progress.successCount}개, 실패: ${progress.failedCount}개`);
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
  console.group("🛑 [API] Job 취소 요청 (V2)");

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

/**
 * PATCH 요청 핸들러
 * Job 일시 중지, 재개, 재시작
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  console.group("🔄 [API] Job 상태 변경 요청 (V2)");

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

    // 3. Request Body 파싱
    const body = await request.json();
    const { action, resumeMode } = body;

    if (!action || !["pause", "resume", "restart"].includes(action)) {
      console.error("❌ 잘못된 action");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "action은 'pause', 'resume', 'restart' 중 하나여야 합니다.",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // 4. 사용자 권한 확인 (자신의 Job만 조작 가능)
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

    // 5. Action에 따라 처리
    let success = false;
    let message = "";

    switch (action) {
      case "pause":
        success = await pauseJob(jobId);
        message = success ? "Job이 일시 중지되었습니다." : "Job 중지에 실패했습니다.";
        break;

      case "resume":
        // resumeMode가 'restart'이면 restartJob 호출, 아니면 resumeJob 호출
        if (resumeMode === "restart") {
          success = await restartJob(jobId);
          message = success ? "Job이 처음부터 다시 시작되었습니다." : "Job 재시작에 실패했습니다.";
        } else {
          success = await resumeJob(jobId);
          message = success ? "Job이 재개되었습니다. (이어서 수집)" : "Job 재개에 실패했습니다.";
        }
        break;

      case "restart":
        success = await restartJob(jobId);
        message = success ? "Job이 처음부터 다시 시작되었습니다." : "Job 재시작에 실패했습니다.";
        break;

      default:
        console.error("❌ 알 수 없는 action");
        console.groupEnd();

        return NextResponse.json(
          {
            success: false,
            error: "알 수 없는 action입니다.",
          } satisfies ApiResponse,
          { status: 400 }
        );
    }

    if (!success) {
      console.error("❌ Job 상태 변경 실패");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: message,
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    console.log(`✅ Job 상태 변경 완료: ${action}`);
    console.groupEnd();

    // 6. 성공 응답
    return NextResponse.json(
      {
        success: true,
        message,
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Job 상태 변경 중 오류:", error);
    console.groupEnd();

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Job 상태 변경 중 오류가 발생했습니다.",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

