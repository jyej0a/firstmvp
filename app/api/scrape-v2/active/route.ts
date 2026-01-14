/**
 * @file app/api/scrape-v2/active/route.ts
 * @description 현재 사용자의 활성 Job 조회 API
 * 
 * 페이지 재방문 시 진행 중인 Job을 복원하기 위해 사용
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { ApiResponse } from "@/types";

/**
 * GET /api/scrape-v2/active
 * 현재 사용자의 활성 Job 조회 (running 또는 paused 상태)
 */
export async function GET() {
  console.group("📋 [API] 활성 Job 조회");

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

    // 2. 활성 Job 조회 (running 또는 paused)
    const supabase = getServiceRoleClient();
    
    const { data: activeJobs, error } = await supabase
      .from("scraping_jobs")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["running", "paused"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("❌ DB 조회 실패:", error);
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "활성 Job 조회 중 오류가 발생했습니다.",
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    const activeJob = activeJobs?.[0] || null;

    if (activeJob) {
      console.log(`✅ 활성 Job 발견: ${activeJob.id}`);
      console.log(`   상태: ${activeJob.status}`);
      console.log(`   진행: ${activeJob.current_count}/${activeJob.total_target}`);
    } else {
      console.log("ℹ️  활성 Job 없음");
    }

    console.groupEnd();

    // 3. 응답 반환
    return NextResponse.json(
      {
        success: true,
        data: activeJob,
        message: activeJob ? "활성 Job을 찾았습니다." : "활성 Job이 없습니다.",
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 예외 발생:", error);
    console.groupEnd();

    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다.",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

