/**
 * @file app/api/scrape-v2/dummy/route.ts
 * @description 더미 테스트 스크래핑 API Route (V2)
 *
 * 테스트용 더미 데이터를 생성하여 실제 스크래핑 없이
 * 순차 처리 로직을 테스트할 수 있도록 합니다.
 *
 * Endpoint: POST /api/scrape-v2/dummy
 *
 * Request Body:
 * {
 *   "totalTarget": number (선택사항, 기본값: 5)
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
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { saveProductsToDatabase } from "@/lib/utils/save-products";
import { createProduct } from "@/lib/shopify/client";
import type { ApiResponse, ScrapedProductRaw } from "@/types";

/**
 * 더미 상품 데이터 생성
 */
function generateDummyProduct(index: number): ScrapedProductRaw {
  const dummyTitles = [
    "Wireless Phone Stand with Adjustable Height",
    "Ergonomic Laptop Stand for Desk",
    "Portable Phone Mount for Car Dashboard",
    "Multi-Angle Tablet Stand Holder",
    "Desktop Monitor Stand with Storage",
    "Flexible Gooseneck Phone Holder",
    "Aluminum Laptop Riser Stand",
    "Magnetic Phone Mount for Car Vent",
    "Adjustable Phone Stand for Desk",
    "Universal Tablet Stand with 360° Rotation",
  ];

  const dummyImages = [
    "https://m.media-amazon.com/images/I/71abc123def._AC_SL1500_.jpg",
    "https://m.media-amazon.com/images/I/72bcd456efg._AC_SL1500_.jpg",
    "https://m.media-amazon.com/images/I/73cde567fgh._AC_SL1500_.jpg",
    "https://m.media-amazon.com/images/I/74def678ghi._AC_SL1500_.jpg",
    "https://m.media-amazon.com/images/I/75efg789hij._AC_SL1500_.jpg",
  ];

  const title = dummyTitles[index % dummyTitles.length];
  const asin = `DUMMY${String(index + 1).padStart(6, "0")}`;
  const price = 19.99 + (index % 10) * 5; // $19.99 ~ $64.99

  return {
    asin,
    title: `${title} (Test ${index + 1})`,
    images: dummyImages.slice(0, 3 + (index % 3)), // 3-5개 이미지
    amazonPrice: price,
    sourceUrl: `https://www.amazon.com/dp/${asin}`,
    description: `This is a dummy test product #${index + 1}. Used for testing the sequential scraping system.`,
  };
}

/**
 * 더미 순차 처리 로직
 */
async function processDummyScraping(
  jobId: string,
  userId: string,
  totalTarget: number
): Promise<void> {
  console.group("🧪 [Dummy Scraper] 더미 순차 처리 시작");
  console.log(`🎯 목표 개수: ${totalTarget}개`);

  try {
    const supabase = getServiceRoleClient();

    // 1. Job 상태를 'running'으로 변경
    await supabase
      .from("scraping_jobs")
      .update({ 
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log(`✅ Job 상태: running`);

    let currentCount = 0;
    let successCount = 0;
    let failedCount = 0;

    // 2. 순차 처리 루프 (1분당 1개 대신 5초당 1개로 빠르게 테스트)
    while (currentCount < totalTarget) {
      try {
        // 취소 확인
        const { data: job } = await supabase
          .from("scraping_jobs")
          .select("status")
          .eq("id", jobId)
          .single();

        if (job?.status === "cancelled") {
          console.log("🛑 Job 취소됨");
          break;
        }

        currentCount++;
        console.log(`\n📦 [${currentCount}/${totalTarget}] 더미 상품 생성 중...`);

        // Job Item 생성
        const { data: jobItem } = await supabase
          .from("scraping_job_items")
          .insert({
            job_id: jobId,
            asin: "",
            status: "scraping",
          })
          .select()
          .single();

        // 더미 상품 생성 (실제 스크래핑 대신)
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 대기 (스크래핑 시뮬레이션)
        const dummyProduct = generateDummyProduct(currentCount - 1);

        // Job Item 업데이트
        if (jobItem) {
          await supabase
            .from("scraping_job_items")
            .update({ 
              asin: dummyProduct.asin,
              status: "saved",
            })
            .eq("id", jobItem.id);
        }

        // 금지어 필터링 (더미 데이터는 통과)
        const { filterByBannedKeywords } = await import("@/lib/utils/filter-banned-keywords");
        const filtered = await filterByBannedKeywords([dummyProduct]);

        if (filtered.filteredProducts.length === 0) {
          console.log(`   ⚠️  금지어 필터링으로 제외됨`);
          failedCount++;
          continue;
        }

        // DB 저장 (V2는 products_v2 테이블 사용)
        const saveResult = await saveProductsToDatabase(filtered.filteredProducts, userId, 'products_v2');
        if (saveResult.failed > 0) {
          console.log(`   ⚠️  DB 저장 실패`);
          failedCount++;
          continue;
        }

        console.log(`   ✅ DB 저장 완료`);

        // Shopify 등록 (더미 모드에서는 실제 등록하지 않음)
        // 실제 등록을 원하면 아래 주석 해제
        /*
        try {
          const savedProduct = await supabase
            .from("products_v2") // V2는 products_v2 테이블 사용
            .select("*")
            .eq("asin", dummyProduct.asin)
            .single();

          if (savedProduct.data) {
            await createProduct(savedProduct.data);
            console.log(`   ✅ Shopify 등록 완료`);
          }
        } catch (shopifyError) {
          console.log(`   ⚠️  Shopify 등록 실패 (무시):`, shopifyError);
        }
        */

        if (jobItem) {
          await supabase
            .from("scraping_job_items")
            .update({ status: "registered" })
            .eq("id", jobItem.id);
        }

        successCount++;

        // Job 진행 상황 업데이트
        await supabase
          .from("scraping_jobs")
          .update({
            current_count: currentCount,
            success_count: successCount,
            failed_count: failedCount,
          })
          .eq("id", jobId);

        // 5초 대기 (테스트용, 실제는 60초)
        // 대기 중에도 취소 상태 체크 (1초마다)
        const waitTime = 5000; // 5초
        const checkInterval = 1000; // 1초
        const totalChecks = Math.ceil(waitTime / checkInterval);
        
        for (let i = 0; i < totalChecks; i++) {
          await new Promise((resolve) => setTimeout(resolve, checkInterval));
          
          // 취소 상태 체크
          const { data: checkJob } = await supabase
            .from("scraping_jobs")
            .select("status")
            .eq("id", jobId)
            .single();

          if (checkJob?.status === "cancelled") {
            console.log("🛑 Job 취소됨 (대기 중 감지)");
            break; // 루프 종료
          }
        }
        
        // 대기 후 최종 취소 확인
        const { data: finalCheck } = await supabase
          .from("scraping_jobs")
          .select("status")
          .eq("id", jobId)
          .single();

        if (finalCheck?.status === "cancelled") {
          console.log("🛑 Job 취소됨");
          break; // 루프 종료
        }

      } catch (itemError) {
        console.error(`❌ 상품 ${currentCount} 처리 실패:`, itemError);
        failedCount++;

        await supabase
          .from("scraping_jobs")
          .update({
            current_count: currentCount,
            failed_count: failedCount,
          })
          .eq("id", jobId);
      }
    }

    // 3. Job 완료
    await supabase
      .from("scraping_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        current_count: currentCount,
        success_count: successCount,
        failed_count: failedCount,
      })
      .eq("id", jobId);

    console.log(`\n✅ 더미 순차 처리 완료!`);
    console.log(`   - 총 처리: ${currentCount}개`);
    console.log(`   - 성공: ${successCount}개`);
    console.log(`   - 실패: ${failedCount}개`);
    console.groupEnd();

  } catch (error) {
    console.error("❌ 더미 순차 처리 중 오류:", error);
    
    await supabase
      .from("scraping_jobs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "알 수 없는 오류",
      })
      .eq("id", jobId);

    console.groupEnd();
    throw error;
  }
}

/**
 * POST 요청 핸들러
 * 더미 테스트 스크래핑 Job 시작
 */
export async function POST(request: NextRequest) {
  console.group("🧪 [API] 더미 테스트 스크래핑 요청 수신 (V2)");

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

    // 2. 요청 바디 파싱
    const body = await request.json();
    const { totalTarget = 5 } = body; // 기본값: 5개

    console.log(`🎯 목표 개수: ${totalTarget}개 (더미 테스트)`);

    // 3. 목표 개수 검증
    if (typeof totalTarget !== "number" || totalTarget <= 0 || totalTarget > 100) {
      console.error("❌ 유효하지 않은 목표 개수");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "목표 개수는 1 이상 100 이하여야 합니다. (더미 테스트는 최대 100개)",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // 4. Job 생성
    const supabase = getServiceRoleClient();
    const { data: job, error: jobError } = await supabase
      .from("scraping_jobs")
      .insert({
        user_id: userId,
        search_input: "[DUMMY TEST]",
        status: "pending",
        total_target: totalTarget,
        current_count: 0,
        success_count: 0,
        failed_count: 0,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("❌ Job 생성 실패:", jobError);
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: `Job 생성 실패: ${jobError?.message || "알 수 없는 오류"}`,
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    console.log(`✅ Job 생성 완료: ${job.id}`);

    // 5. 백그라운드 작업 시작 (비동기 실행)
    processDummyScraping(job.id, userId, totalTarget).catch((error) => {
      console.error("❌ 더미 순차 처리 중 예상치 못한 오류:", error);
      supabase
        .from("scraping_jobs")
        .update({
          status: "failed",
          error_message: error.message,
        })
        .eq("id", job.id)
        .catch((updateError) => {
          console.error("❌ Job 상태 업데이트 실패:", updateError);
        });
    });

    console.log("✅ 백그라운드 작업 시작됨");
    console.groupEnd();

    // 6. 즉시 응답 (202 Accepted)
    return NextResponse.json(
      {
        success: true,
        data: {
          jobId: job.id,
          message: "더미 테스트 작업이 시작되었습니다.",
        },
        message: "더미 테스트 작업이 시작되었습니다. 진행 상황을 확인하세요.",
      } satisfies ApiResponse,
      { status: 202 }
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

