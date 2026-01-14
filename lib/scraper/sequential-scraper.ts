/**
 * @file lib/scraper/sequential-scraper.ts
 * @description 순차 처리 스크래핑 로직
 *
 * 이 파일은 1분당 1개씩 순차적으로 상품을 수집하고,
 * DB 저장 및 Shopify 등록까지 자동으로 처리하는 기능을 제공합니다.
 *
 * 주요 기능:
 * 1. Job 생성 및 관리 (scraping_jobs 테이블)
 * 2. 순차 처리 루프 (1개 수집 → 필터링 → 저장 → 등록)
 * 3. 진행 상황 실시간 업데이트
 * 4. 에러 처리 및 재시도 로직
 *
 * @see {@link /docs/PRD.md} - KPI: 1분당 1개 수집, 하루 최대 1000개
 * @see {@link /supabase/migrations/20251215153310_create_scraping_jobs_table.sql} - Job 테이블 스키마
 */

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { filterByBannedKeywords } from "@/lib/utils/filter-banned-keywords";
import { saveProductsToDatabase } from "@/lib/utils/save-products";
import { createProduct } from "@/lib/shopify/client";
import { scrapeSingleProduct } from "./amazon-scraper";
import { sendDiscord } from "@/lib/discord";
import { categorizeError, errorInfoToDbUpdate } from "@/lib/utils/error-handler";
import type { ScrapedProductRaw, Product } from "@/types";

/**
 * Job 상태 타입
 */
export type JobStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";

/**
 * Job Item 상태 타입
 */
export type JobItemStatus = "pending" | "scraping" | "saved" | "registered" | "failed";

/**
 * Job 생성 인터페이스
 */
export interface CreateJobParams {
  userId: string;
  searchInput: string;
  totalTarget?: number; // 기본값: 1000
}

/**
 * Job 정보 인터페이스
 */
export interface JobInfo {
  id: string;
  userId: string;
  searchInput: string;
  status: JobStatus;
  totalTarget: number;
  currentCount: number;
  successCount: number;
  failedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Job 진행 상황 인터페이스
 */
export interface JobProgress {
  jobId: string;
  status: JobStatus;
  currentCount: number;
  totalTarget: number;
  successCount: number;
  failedCount: number;
  estimatedTimeRemaining: number; // 초 단위
  progressPercentage: number; // 0-100
  startedAt: string | null; // 작업 시작 시간 (실 소요시간 계산용)
}

/**
 * 순차 스크래핑 시작
 *
 * Job을 생성하고 백그라운드에서 순차 처리를 시작합니다.
 * 즉시 Job ID를 반환하여 클라이언트가 진행 상황을 조회할 수 있도록 합니다.
 *
 * @param params - Job 생성 파라미터
 * @returns 생성된 Job ID
 */
export async function startSequentialScraping(
  params: CreateJobParams
): Promise<string> {
  console.group("🚀 [Sequential Scraper] Job 시작");
  const { userId, searchInput, totalTarget = 1000 } = params;

  console.log(`👤 사용자 ID: ${userId}`);
  console.log(`🔍 검색 입력: ${searchInput}`);
  console.log(`🎯 목표 개수: ${totalTarget}개`);

  try {
    const supabase = getServiceRoleClient();

    // 1. Job 생성
    const { data: job, error: jobError } = await supabase
      .from("scraping_jobs")
      .insert({
        user_id: userId,
        search_input: searchInput,
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
      throw new Error(`Job 생성 실패: ${jobError?.message || "알 수 없는 오류"}`);
    }

    console.log(`✅ Job 생성 완료: ${job.id}`);

    // 2. 백그라운드 작업 시작 (비동기 실행, await 하지 않음)
    processSequentialScraping(job.id, userId, searchInput, totalTarget).catch(
      (error) => {
        console.error("❌ 순차 처리 중 예상치 못한 오류:", error);
        // Job 상태를 'failed'로 업데이트
        updateJobStatus(job.id, "failed", error.message).catch((updateError) => {
          console.error("❌ Job 상태 업데이트 실패:", updateError);
        });
      }
    );

    console.log("✅ 백그라운드 작업 시작됨");
    console.groupEnd();

    return job.id;
  } catch (error) {
    console.error("❌ Job 시작 실패:", error);
    console.groupEnd();
    throw error;
  }
}

/**
 * 순차 처리 메인 로직
 *
 * 1개씩 상품을 수집하고, 필터링, 저장, 등록을 순차적으로 처리합니다.
 *
 * @param jobId - Job ID
 * @param userId - 사용자 ID
 * @param searchInput - 검색 입력값
 * @param totalTarget - 목표 개수
 */
async function processSequentialScraping(
  jobId: string,
  userId: string,
  searchInput: string,
  totalTarget: number
): Promise<void> {
  console.group(`🔄 [Sequential Scraper] Job ${jobId} 처리 시작`);

  try {
    const supabase = getServiceRoleClient();

    // 1. Job 정보 조회 (재개 시 started_at 유지하기 위해)
    const { data: existingJob } = await supabase
      .from("scraping_jobs")
      .select("status, started_at, current_count")
      .eq("id", jobId)
      .single();

    // 2. Job 상태를 'running'으로 변경
    await updateJobStatus(jobId, "running");
    
    // 3. started_at은 재개 시 유지 (처음 시작한 시간 보존)
    if (!existingJob?.started_at) {
      // 처음 시작하는 경우에만 started_at 설정
      const startedAt = new Date().toISOString();
      await supabase
        .from("scraping_jobs")
        .update({ started_at: startedAt })
        .eq("id", jobId);
      console.log(`✅ Job 시작: ${startedAt}`);
    } else {
      console.log(`✅ Job 재개: 기존 시작 시간 유지 (${existingJob.started_at})`);
    }

    console.log(`🎯 목표: ${totalTarget}개 수집`);

    // 2. URL 처리 (키워드 → Amazon URL 변환)
    const { processSearchInput } = await import("@/lib/utils/url-processor");
    const processed = processSearchInput(searchInput);
    const searchUrl = processed.url;

    console.log(`🔗 검색 URL: ${searchUrl}`);

    // 4. 순차 처리 루프
    // 재개 시 DB에서 최신 카운트 가져오기 (멈춘 구간부터 이어서 수집)
    let currentCount = existingJob?.current_count || 0;
    let successCount = 0;
    let failedCount = 0;
    let lastRequestTime = 0; // Rate Limiting용
    
    // DB에서 최신 통계 가져오기
    const { data: jobStats } = await supabase
      .from("scraping_jobs")
      .select("success_count, failed_count")
      .eq("id", jobId)
      .single();
    
    if (jobStats) {
      successCount = jobStats.success_count || 0;
      failedCount = jobStats.failed_count || 0;
    }
    
    console.log(`📊 현재 진행: ${currentCount}/${totalTarget} (성공: ${successCount}, 실패: ${failedCount})`);

    while (currentCount < totalTarget) {
      try {
        // 취소/중지 상태 체크 (루프 시작 시마다 확인)
        const currentJob = await supabase
          .from("scraping_jobs")
          .select("status, current_count, success_count, failed_count")
          .eq("id", jobId)
          .single();

        const jobStatus = currentJob.data?.status;
        
        if (jobStatus === "cancelled") {
          console.log(`🛑 Job 취소 감지, 루프 종료`);
          console.groupEnd();
          return; // 루프 종료
        }

        if (jobStatus === "paused") {
          console.log(`⏸️  Job 일시 중지 감지, 프로세스 종료`);
          console.log(`   현재 진행: ${currentCount}/${totalTarget}`);
          console.log(`   재개 시 이 지점부터 계속됩니다`);
          console.groupEnd();
          // paused 상태면 프로세스를 완전히 종료 (백그라운드 실행 중단)
          return;
        }

        // DB에서 최신 카운트 가져오기 (재개 시 동기화)
        if (currentJob.data) {
          currentCount = currentJob.data.current_count || 0;
          successCount = currentJob.data.success_count || 0;
          failedCount = currentJob.data.failed_count || 0;
        }

        // Rate Limiting 체크 (1분당 1개)
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        const minIntervalMs = 60 * 1000; // 1분

        if (timeSinceLastRequest < minIntervalMs && lastRequestTime > 0) {
          const waitTime = minIntervalMs - timeSinceLastRequest;
          console.log(`⏳ Rate Limit 대기: ${Math.ceil(waitTime / 1000)}초`);
          
          // 대기 중에도 취소/중지 상태 체크 (1초마다)
          const checkInterval = 1000; // 1초
          const totalChecks = Math.ceil(waitTime / checkInterval);
          
          for (let i = 0; i < totalChecks; i++) {
            await new Promise((resolve) => setTimeout(resolve, checkInterval));
            
            // 취소/중지 상태 체크
            const checkJob = await supabase
              .from("scraping_jobs")
              .select("status")
              .eq("id", jobId)
              .single();

            if (checkJob.data?.status === "cancelled") {
              console.log(`🛑 Job 취소 감지, 대기 중단`);
              console.groupEnd();
              return; // 루프 종료
            }

            if (checkJob.data?.status === "paused") {
              // paused 상태면 프로세스 완전히 종료
              console.log(`⏸️  Job 일시 중지 감지, 프로세스 종료`);
              console.log(`   현재 진행: ${currentCount}/${totalTarget}`);
              console.groupEnd();
              return;
            }
          }
          
          // Rate Limit 대기 후에도 paused 상태인지 다시 확인
          const afterWaitCheck = await supabase
            .from("scraping_jobs")
            .select("status")
            .eq("id", jobId)
            .single();

          if (afterWaitCheck.data?.status === "paused") {
            // paused 상태면 프로세스 완전히 종료
            console.log(`⏸️  Job 일시 중지 감지, 프로세스 종료`);
            console.log(`   현재 진행: ${currentCount}/${totalTarget}`);
            console.groupEnd();
            return;
          }
        }

        // 스크래핑 시작 전 다시 한 번 상태 체크 (중지 요청이 있을 수 있음)
        const preCheckJob = await supabase
          .from("scraping_jobs")
          .select("status")
          .eq("id", jobId)
          .single();

        if (preCheckJob.data?.status === "cancelled") {
          console.log(`🛑 Job 취소 감지, 스크래핑 시작 전 중단`);
          console.groupEnd();
          return;
        }

        if (preCheckJob.data?.status === "paused") {
          // paused 상태면 프로세스를 완전히 종료 (재개 대기 루프 제거, 조용히 종료)
          console.log(`⏸️  Job 일시 중지 감지, 프로세스 종료`);
          console.log(`   현재 진행: ${currentCount}/${totalTarget}`);
          console.log(`   재개 시 이 지점부터 계속됩니다`);
              console.groupEnd();
          return; // paused 상태면 프로세스 완전히 종료
        }

        console.log(`\n📦 [${currentCount + 1}/${totalTarget}] 상품 수집 시작`);

        // 3-1. 1개 상품 수집
        let scrapedProduct: ScrapedProductRaw | null = null;
        let jobItemId: string | null = null;

        try {
          // Job Item 생성 (pending 상태)
          const { data: jobItem, error: itemError } = await supabase
            .from("scraping_job_items")
            .insert({
              job_id: jobId,
              asin: "", // 나중에 업데이트
              status: "pending",
            })
            .select()
            .single();

          if (itemError || !jobItem) {
            console.error("❌ Job Item 생성 실패:", itemError);
            throw new Error(`Job Item 생성 실패: ${itemError?.message}`);
          }

          jobItemId = jobItem.id;

          // Job Item 상태를 'scraping'으로 변경
          await supabase
            .from("scraping_job_items")
            .update({ status: "scraping" })
            .eq("id", jobItemId);

          // 스크래핑 시작 전 paused 상태 체크
          const beforeScrapeCheck = await supabase
            .from("scraping_jobs")
            .select("status")
            .eq("id", jobId)
            .single();

          if (beforeScrapeCheck.data?.status === "paused") {
            // Job Item 정리 (로그 없이 조용히)
            if (jobItemId) {
              await supabase
                .from("scraping_job_items")
                .delete()
                .eq("id", jobItemId);
            }
            // paused 상태면 프로세스 완전히 종료
            console.log(`⏸️  Job 일시 중지 감지, 프로세스 종료`);
            console.log(`   현재 진행: ${currentCount}/${totalTarget}`);
            console.groupEnd();
            return;
          }

          if (beforeScrapeCheck.data?.status === "cancelled") {
            console.log(`🛑 Job 취소 감지, 프로세스 종료`);
            console.groupEnd();
            return;
          }

          // 1개 상품 수집 (재시도 로직 포함)
          let retryCount = 0;
          const maxRetries = 2; // 최대 2회 재시도

          while (retryCount <= maxRetries) {
            try {
              scrapedProduct = await scrapeSingleProduct(searchUrl, currentCount);

              if (!scrapedProduct) {
                // null 반환 시 더 자세한 오류 정보 제공
                // scrapeSingleProduct 내부에서 이미 로그를 남겼으므로 여기서는 에러만 던짐
                const productsPerPage = 16;
                const targetPage = Math.floor(currentCount / productsPerPage) + 1;
                const targetIndex = currentCount % productsPerPage;
                
                throw new Error(
                  `상품 수집 실패: 결과가 null입니다 (offset: ${currentCount}, 페이지: ${targetPage}, 인덱스: ${targetIndex})`
                );
              }

              // ASIN 중복 체크 (수집 후 확인)
              // TODO: 더 효율적으로 하려면 검색 결과 페이지에서 ASIN만 먼저 추출하여 체크
              const { checkAsinExists } = await import("@/lib/utils/check-asin-exists");
              const exists = await checkAsinExists(scrapedProduct.asin);

              if (exists) {
                console.log(`⏭️  중복 ASIN 감지, 건너뜀: ${scrapedProduct.asin} (${scrapedProduct.title.substring(0, 50)}...)`);
                
                // Job Item 상태를 'failed'로 변경 (중복)
                const duplicateError = categorizeError(
                  new Error("이미 존재하는 ASIN (중복)"),
                  { offset: currentCount, searchUrl }
                );
                const duplicateErrorUpdate = errorInfoToDbUpdate(duplicateError);
                
                await supabase
                  .from("scraping_job_items")
                  .update({
                    status: "failed",
                    asin: scrapedProduct.asin,
                    error_message: duplicateError.reason,
                    ...duplicateErrorUpdate,
                  })
                  .eq("id", jobItemId);

                failedCount++;
                currentCount++;
                await updateJobProgress(jobId, currentCount, successCount, failedCount);
                lastRequestTime = Date.now();
                scrapedProduct = null; // 다음 단계로 진행하지 않음
                break; // 재시도 루프 종료
              }

              break; // 성공 시 루프 종료
            } catch (retryError) {
              retryCount++;

              if (retryCount > maxRetries) {
                // 최대 재시도 횟수 초과
                throw retryError;
              }

              // 지수 백오프 대기 (1초, 2초) - 취소/중지 체크 포함
              const delaySeconds = Math.pow(2, retryCount - 1);
              console.log(`⏳ 재시도 ${retryCount}/${maxRetries} - ${delaySeconds}초 대기 중...`);
              
              // 대기 중 취소/중지 상태 체크 (1초마다)
              const checkInterval = 1000;
              const totalChecks = Math.ceil(delaySeconds);
              
              for (let i = 0; i < totalChecks; i++) {
                await new Promise((resolve) => setTimeout(resolve, checkInterval));
                
                // 취소/중지 상태 체크
                const checkJob = await supabase
                  .from("scraping_jobs")
                  .select("status")
                  .eq("id", jobId)
                  .single();

                if (checkJob.data?.status === "cancelled") {
                  console.log(`🛑 Job 취소 감지, 재시도 중단`);
                  console.groupEnd();
                  return; // 루프 종료
                }

                if (checkJob.data?.status === "paused") {
                  // paused 상태면 프로세스 완전히 종료
                  console.log(`⏸️  Job 일시 중지 감지, 프로세스 종료`);
                  console.log(`   현재 진행: ${currentCount}/${totalTarget}`);
                  console.groupEnd();
                  return;
                }
              }
            }
          }

          // 중복으로 인해 건너뛴 경우 다음 상품으로
          if (!scrapedProduct) {
            continue;
          }

          if (!scrapedProduct) {
            throw new Error("상품 수집 실패: 재시도 후에도 실패");
          }

          // Job Item에 ASIN 업데이트
          await supabase
            .from("scraping_job_items")
            .update({ asin: scrapedProduct.asin })
            .eq("id", jobItemId);

          console.log(`✅ 수집 완료: ${scrapedProduct.title.substring(0, 50)}...`);
        } catch (scrapeError) {
          // paused 상태로 인한 중단은 이미 위에서 return으로 처리됨
          // 여기서는 일반 에러만 처리
          console.error("❌ 상품 수집 실패:", scrapeError);
          failedCount++;
          currentCount++;

          // 오류 분류 및 상세 정보 수집
          const productsPerPage = 16;
          const targetPage = Math.floor(currentCount / productsPerPage) + 1;
          const targetIndex = currentCount % productsPerPage;
          
          // 오류 메시지에서 추출된 상품 수 정보 파싱 (있는 경우)
          const scrapeErrorMessage = scrapeError instanceof Error ? scrapeError.message : String(scrapeError);
          const productsCountMatch = scrapeErrorMessage.match(/추출된 상품 수: (\d+)/);
          const productsCount = productsCountMatch ? parseInt(productsCountMatch[1], 10) : undefined;
          
          const errorInfo = categorizeError(scrapeError, {
            offset: currentCount,
            searchUrl,
            targetIndex,
            productsCount,
          });
          const errorUpdate = errorInfoToDbUpdate(errorInfo);

          // Job Item 상태를 'failed'로 변경 (새로 추가한 필드들 포함)
          if (jobItemId) {
            await supabase
              .from("scraping_job_items")
              .update({
                status: "failed",
                error_message: errorInfo.reason, // 기존 필드도 유지 (호환성)
                ...errorUpdate, // 새로 추가한 필드들
              })
              .eq("id", jobItemId);
          }

          // Job 상태 업데이트
          await updateJobProgress(jobId, currentCount, successCount, failedCount);

          // 🔔 Discord 오류 알림 (에러는 로그만 남기고 계속 진행)
          const errorMessage = scrapeError instanceof Error 
            ? scrapeError.message 
            : "알 수 없는 오류";
          
          sendDiscord({
            content: `❌ 스크래핑 오류 발생\n` +
              `Job ID: ${jobId}\n` +
              `오류: ${errorMessage}\n` +
              `현재 진행: ${currentCount}/${totalTarget}`
          }).catch(err => console.error('[Discord] 알림 전송 실패:', err));

          // 다음 상품으로 계속 진행
          lastRequestTime = Date.now();
          continue;
        }

        // 3-2. 금지어 필터링
        const filterResult = await filterByBannedKeywords([scrapedProduct]);

        if (filterResult.stats.filteredOut > 0) {
          console.log(`🚫 금지어 필터링으로 제외됨`);
          failedCount++;
          currentCount++;

          // Job Item 상태를 'failed'로 변경
          if (jobItemId) {
            await supabase
              .from("scraping_job_items")
              .update({
                status: "failed",
                error_message: "금지어 포함으로 필터링됨",
              })
              .eq("id", jobItemId);
          }

          await updateJobProgress(jobId, currentCount, successCount, failedCount);
          lastRequestTime = Date.now();
          continue;
        }

        const filteredProduct = filterResult.filteredProducts[0];

        // DB 저장 전 paused 상태 체크
        const beforeSaveCheck = await supabase
          .from("scraping_jobs")
          .select("status")
          .eq("id", jobId)
          .single();

        if (beforeSaveCheck.data?.status === "paused") {
          // Job Item 정리 (로그 없이 조용히)
          if (jobItemId) {
            await supabase
              .from("scraping_job_items")
              .delete()
              .eq("id", jobItemId);
          }
          // paused 상태면 프로세스 완전히 종료
          console.log(`⏸️  Job 일시 중지 감지, 프로세스 종료`);
          console.log(`   현재 진행: ${currentCount}/${totalTarget}`);
          console.groupEnd();
          return;
        }

        if (beforeSaveCheck.data?.status === "cancelled") {
          console.log(`🛑 Job 취소 감지, 프로세스 종료`);
          console.groupEnd();
          return;
        }

        // 3-3. DB 저장 (재시도 로직 포함)
        let savedProductId: string | null = null;
        try {
          let saveRetryCount = 0;
          const maxSaveRetries = 1; // DB 저장은 1회 재시도

          while (saveRetryCount <= maxSaveRetries) {
            try {
              const saveResult = await saveProductsToDatabase([filteredProduct], userId, 'products_v2'); // V2는 products_v2 테이블 사용

              if (saveResult.saved === 0 || saveResult.failed > 0) {
                throw new Error(
                  `DB 저장 실패: ${saveResult.errors[0]?.error || "알 수 없는 오류"}`
                );
              }

              break; // 성공 시 루프 종료
            } catch (saveRetryError) {
              saveRetryCount++;

              if (saveRetryCount > maxSaveRetries) {
                throw saveRetryError;
              }

              // 1초 대기 후 재시도 (취소 체크 포함)
              console.log(`⏳ DB 저장 재시도 ${saveRetryCount}/${maxSaveRetries}...`);
              
              // 대기 중 취소 상태 체크
              const checkJob = await supabase
                .from("scraping_jobs")
                .select("status")
                .eq("id", jobId)
                .single();

              if (checkJob.data?.status === "cancelled") {
                console.log(`🛑 Job 취소 감지, DB 저장 재시도 중단`);
                console.groupEnd();
                return; // 루프 종료
              }
              
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }

          // 저장된 상품 ID 조회 (ASIN만으로 조회, ASIN이 unique이므로)
          const { data: savedProduct } = await supabase
            .from("products_v2") // V2는 products_v2 테이블 사용
            .select("id")
            .eq("asin", filteredProduct.asin)
            .single();

          savedProductId = savedProduct?.id || null;

          // Job Item에 product_id 연결
          if (jobItemId && savedProductId) {
            await supabase
              .from("scraping_job_items")
              .update({
                product_id: savedProductId,
                status: "saved",
              })
              .eq("id", jobItemId);
          }

          console.log(`✅ DB 저장 완료`);
        } catch (saveError) {
          console.error("❌ DB 저장 실패:", saveError);
          failedCount++;
          currentCount++;

          if (jobItemId) {
            await supabase
              .from("scraping_job_items")
              .update({
                status: "failed",
                error_message:
                  saveError instanceof Error
                    ? saveError.message
                    : "DB 저장 실패",
              })
              .eq("id", jobItemId);
          }

          await updateJobProgress(jobId, currentCount, successCount, failedCount);
          lastRequestTime = Date.now();
          continue;
        }

        // Shopify 등록 전 paused 상태 체크
        const beforeShopifyCheck = await supabase
          .from("scraping_jobs")
          .select("status")
          .eq("id", jobId)
          .single();

        if (beforeShopifyCheck.data?.status === "paused") {
          // Job Item은 'saved' 상태 유지 (나중에 수동 등록 가능)
          // paused 상태면 프로세스 완전히 종료
          console.log(`⏸️  Job 일시 중지 감지, 프로세스 종료`);
          console.log(`   현재 진행: ${currentCount}/${totalTarget}`);
          console.groupEnd();
          return;
        }

        if (beforeShopifyCheck.data?.status === "cancelled") {
          console.log(`🛑 Job 취소 감지, 프로세스 종료`);
          console.groupEnd();
          return;
        }

        // 3-4. Shopify 등록 (재시도 로직 포함)
        try {
          if (!savedProductId) {
            throw new Error("저장된 상품 ID를 찾을 수 없습니다");
          }

          // 저장된 상품 정보 조회
          const { data: productRow, error: productError } = await supabase
            .from("products_v2") // V2는 products_v2 테이블 사용
            .select("*")
            .eq("id", savedProductId)
            .single();

          if (productError || !productRow) {
            throw new Error(`상품 조회 실패: ${productError?.message}`);
          }

          // DB 데이터를 Product 타입으로 변환 (snake_case → camelCase)
          let finalCategory = productRow.category || 'General';
          
          // 카테고리가 있고 'General'이 아니면 쇼피파이 카테고리 매칭 시도
          if (finalCategory && finalCategory !== 'General') {
            try {
              const { matchCategoryToShopify } = await import("@/lib/utils/category-matcher");
              const matchResult = await matchCategoryToShopify(finalCategory);
              
              if (matchResult.success && matchResult.shopifyCategoryName) {
                // 매칭 성공 시 쇼피파이 카테고리 이름 사용
                finalCategory = matchResult.shopifyCategoryName;
                console.log(`✅ 카테고리 매칭 성공: ${finalCategory} (신뢰도: ${matchResult.confidence?.toFixed(2)})`);
              } else {
                console.warn(`⚠️  카테고리 매칭 실패: ${finalCategory} → ${matchResult.error || '알 수 없는 오류'}`);
                // 매칭 실패해도 원본 카테고리 사용
              }
            } catch (matchError) {
              console.error("❌ 카테고리 매칭 중 에러:", matchError);
              // 에러 발생 시 원본 카테고리 사용
            }
          }

          const product: Product = {
            id: productRow.id,
            userId: productRow.user_id,
            asin: productRow.asin,
            sourceUrl: productRow.source_url,
            title: productRow.title,
            description: productRow.description,
            images: productRow.images,
            variants: productRow.variants,
            category: finalCategory,
            reviewCount: productRow.review_count ?? null,
            rating: productRow.rating ?? null,
            brand: productRow.brand ?? null,
            weight: productRow.weight ? Number(productRow.weight) : null,
            sourcingType: productRow.sourcing_type as "US" | "CN",
            amazonPrice: Number(productRow.amazon_price),
            costPrice: productRow.cost_price ? Number(productRow.cost_price) : null,
            shippingCost: productRow.shipping_cost ? Number(productRow.shipping_cost) : null,
            extraCost: productRow.extra_cost ? Number(productRow.extra_cost) : null,
            marginRate: Number(productRow.margin_rate),
            sellingPrice: Number(productRow.selling_price),
            status: productRow.status as "draft" | "uploaded" | "error",
            errorMessage: productRow.error_message,
            createdAt: productRow.created_at,
            updatedAt: productRow.updated_at,
          };

          // Shopify 등록 (재시도 로직 포함)
          let shopifyRetryCount = 0;
          const maxShopifyRetries = 1; // Shopify 등록은 1회 재시도

          while (shopifyRetryCount <= maxShopifyRetries) {
            try {
              const shopifyResult = await createProduct(product);

              if (!shopifyResult.success) {
                throw new Error(shopifyResult.error || "Shopify 등록 실패");
              }

              break; // 성공 시 루프 종료
            } catch (shopifyRetryError) {
              shopifyRetryCount++;

              if (shopifyRetryCount > maxShopifyRetries) {
                throw shopifyRetryError;
              }

              // 2초 대기 후 재시도
              console.log(`⏳ Shopify 등록 재시도 ${shopifyRetryCount}/${maxShopifyRetries}...`);
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }

          // Job Item 상태를 'registered'로 변경
          if (jobItemId) {
            await supabase
              .from("scraping_job_items")
              .update({ status: "registered" })
              .eq("id", jobItemId);
          }

          // products_v2 테이블의 status를 'uploaded'로 업데이트
          await supabase
            .from("products_v2") // V2는 products_v2 테이블 사용
            .update({ status: "uploaded" })
            .eq("id", savedProductId);

          console.log(`✅ Shopify 등록 완료`);
          successCount++;
        } catch (shopifyError) {
          console.error("❌ Shopify 등록 실패:", shopifyError);
          failedCount++; // 실패 카운트 증가
          // Shopify 등록 실패해도 다음 상품 계속 진행
          // Job Item은 'saved' 상태 유지 (나중에 수동 등록 가능)
        }

        // 3-5. 진행 상황 업데이트
        currentCount++;
        await updateJobProgress(jobId, currentCount, successCount, failedCount);

        console.log(
          `📊 진행 상황: ${currentCount}/${totalTarget} (성공: ${successCount}, 실패: ${failedCount})`
        );

        // 3-6. 다음 수집 전 1분 대기 (Rate Limiting)
        lastRequestTime = Date.now();
        if (currentCount < totalTarget) {
          console.log(`⏳ 다음 수집까지 1분 대기 중...`);
          
          // 대기 중에도 취소/중지 상태 체크 (1초마다)
          const waitTime = 60 * 1000; // 1분
          const checkInterval = 1000; // 1초
          const totalChecks = Math.ceil(waitTime / checkInterval);
          
          for (let i = 0; i < totalChecks; i++) {
            await new Promise((resolve) => setTimeout(resolve, checkInterval));
            
            // 취소/중지 상태 체크
            const checkJob = await supabase
              .from("scraping_jobs")
              .select("status")
              .eq("id", jobId)
              .single();

            if (checkJob.data?.status === "cancelled") {
              console.log(`🛑 Job 취소 감지, 대기 중단`);
              console.groupEnd();
              return; // 루프 종료
            }

            if (checkJob.data?.status === "paused") {
              console.log(`⏸️  Job 일시 중지 감지, 프로세스 종료`);
              console.log(`   현재 진행: ${currentCount}/${totalTarget}`);
              console.groupEnd();
              return;
            }
          }
          
          // 대기 후 최종 취소/중지 확인
          const finalCheck = await supabase
            .from("scraping_jobs")
            .select("status")
            .eq("id", jobId)
            .single();

          if (finalCheck.data?.status === "cancelled") {
            console.log(`🛑 Job 취소 감지, 루프 종료`);
            console.groupEnd();
            return;
          }

          if (finalCheck.data?.status === "paused") {
            console.log(`⏸️  Job 일시 중지 감지, 프로세스 종료`);
            console.log(`   현재 진행: ${currentCount}/${totalTarget}`);
            console.groupEnd();
            return;
          }
        }
      } catch (loopError) {
        console.error("❌ 루프 처리 중 오류:", loopError);
        // 개별 상품 처리 실패는 계속 진행
        currentCount++;
        failedCount++;
        await updateJobProgress(jobId, currentCount, successCount, failedCount);
        lastRequestTime = Date.now();
      }
    }

    // 4. 완료 처리
    const completedAt = new Date().toISOString();
    await supabase
      .from("scraping_jobs")
      .update({
        status: "completed",
        completed_at: completedAt,
      })
      .eq("id", jobId);

    console.log(`\n🎉 Job 완료!`);
    console.log(`   총 수집: ${currentCount}개`);
    console.log(`   성공: ${successCount}개`);
    console.log(`   실패: ${failedCount}개`);
    console.groupEnd();
  } catch (error) {
    console.error("❌ 순차 처리 실패:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : "알 수 없는 오류";
    
    await updateJobStatus(
      jobId,
      "failed",
      errorMessage
    );
    
    // 🔔 Discord 전체 작업 실패 알림
    sendDiscord({
      content: `🚨 스크래핑 작업 전체 실패\n` +
        `Job ID: ${jobId}\n` +
        `오류: ${errorMessage}\n` +
        `작업이 중단되었습니다.`
    }).catch(err => console.error('[Discord] 알림 전송 실패:', err));
    
    console.groupEnd();
    throw error;
  }
}

/**
 * Job 상태 업데이트
 *
 * @param jobId - Job ID
 * @param status - 새로운 상태
 * @param errorMessage - 에러 메시지 (선택사항)
 */
async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  errorMessage?: string
): Promise<void> {
  const supabase = getServiceRoleClient();

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { error } = await supabase
    .from("scraping_jobs")
    .update(updateData)
    .eq("id", jobId);

  if (error) {
    console.error("❌ Job 상태 업데이트 실패:", error);
    throw new Error(`Job 상태 업데이트 실패: ${error.message}`);
  }
}

/**
 * Job 진행 상황 업데이트
 *
 * @param jobId - Job ID
 * @param currentCount - 현재 수집된 개수
 * @param successCount - 성공한 개수
 * @param failedCount - 실패한 개수
 */
async function updateJobProgress(
  jobId: string,
  currentCount: number,
  successCount: number,
  failedCount: number
): Promise<void> {
  const supabase = getServiceRoleClient();

  const { error } = await supabase
    .from("scraping_jobs")
    .update({
      current_count: currentCount,
      success_count: successCount,
      failed_count: failedCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("❌ 진행 상황 업데이트 실패:", error);
    // 에러가 발생해도 계속 진행
  }
}

/**
 * Job 진행 상황 조회
 *
 * @param jobId - Job ID
 * @returns Job 진행 상황 정보
 */
export async function getJobProgress(jobId: string): Promise<JobProgress | null> {
  const supabase = getServiceRoleClient();

  const { data: job, error } = await supabase
    .from("scraping_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    console.error("❌ Job 조회 실패:", error);
    return null;
  }

  // 예상 남은 시간 계산 (초 단위)
  let estimatedTimeRemaining = 0;
  if (job.status === "running" && job.current_count < job.total_target) {
    const remaining = job.total_target - job.current_count;
    estimatedTimeRemaining = remaining * 60; // 1분당 1개
  }

  // 진행률 계산 (0-100)
  const progressPercentage =
    job.total_target > 0
      ? Math.round((job.current_count / job.total_target) * 100)
      : 0;

  return {
    jobId: job.id,
    status: job.status as JobStatus,
    currentCount: job.current_count,
    totalTarget: job.total_target,
    successCount: job.success_count,
    failedCount: job.failed_count,
    estimatedTimeRemaining,
    progressPercentage,
    startedAt: job.started_at,
  };
}

/**
 * Job 정보 조회
 *
 * @param jobId - Job ID
 * @returns Job 정보
 */
export async function getJobInfo(jobId: string): Promise<JobInfo | null> {
  const supabase = getServiceRoleClient();

  const { data: job, error } = await supabase
    .from("scraping_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    console.error("❌ Job 조회 실패:", error);
    return null;
  }

  return {
    id: job.id,
    userId: job.user_id,
    searchInput: job.search_input,
    status: job.status as JobStatus,
    totalTarget: job.total_target,
    currentCount: job.current_count,
    successCount: job.success_count,
    failedCount: job.failed_count,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

/**
 * Job 취소
 *
 * @param jobId - Job ID
 * @returns 취소 성공 여부
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  console.group(`🛑 [Sequential Scraper] Job ${jobId} 취소 요청`);

  try {
    const supabase = getServiceRoleClient();

    // Job 상태 확인
    const jobInfo = await getJobInfo(jobId);
    if (!jobInfo) {
      console.error("❌ Job을 찾을 수 없습니다");
      console.groupEnd();
      return false;
    }

    // 이미 완료되었거나 취소된 Job은 취소 불가
    if (jobInfo.status === "completed" || jobInfo.status === "cancelled") {
      console.warn(`⚠️  Job이 이미 ${jobInfo.status} 상태입니다`);
      console.groupEnd();
      return false;
    }

    // Job 상태를 'cancelled'로 변경
    const cancelledAt = new Date().toISOString();
    const { error } = await supabase
      .from("scraping_jobs")
      .update({
        status: "cancelled",
        completed_at: cancelledAt,
        error_message: "사용자에 의해 취소됨",
        updated_at: cancelledAt,
      })
      .eq("id", jobId);

    if (error) {
      console.error("❌ Job 취소 실패:", error);
      console.groupEnd();
      return false;
    }

    console.log(`✅ Job 취소 완료`);
    console.log(`   취소 시점: ${cancelledAt}`);
    console.log(`   수집된 상품: ${jobInfo.currentCount}개`);
    console.groupEnd();

    return true;
  } catch (error) {
    console.error("❌ Job 취소 중 오류:", error);
    console.groupEnd();
    return false;
  }
}

/**
 * Job 일시 중지
 *
 * @param jobId - Job ID
 * @returns 중지 성공 여부
 */
export async function pauseJob(jobId: string): Promise<boolean> {
  console.group(`⏸️  [Sequential Scraper] Job ${jobId} 일시 중지 요청`);

  try {
    const supabase = getServiceRoleClient();

    // Job 상태 확인
    const jobInfo = await getJobInfo(jobId);
    if (!jobInfo) {
      console.error("❌ Job을 찾을 수 없습니다");
      console.groupEnd();
      return false;
    }

    // 상태별 처리
    let newStatus: "paused" | "cancelled" = "paused";
    
    // completed, failed, cancelled 상태는 이미 종료된 Job
    if (["completed", "failed", "cancelled"].includes(jobInfo.status)) {
      console.log(`ℹ️  Job이 이미 ${jobInfo.status} 상태입니다. cancelled로 변경합니다.`);
      newStatus = "cancelled";
    }
    // running, pending 상태는 일시 중지
    else if (["running", "pending"].includes(jobInfo.status)) {
      console.log(`⏸️  Job을 일시 중지합니다 (현재 상태: ${jobInfo.status})`);
      newStatus = "paused";
    }
    // paused 상태는 이미 중지됨
    else if (jobInfo.status === "paused") {
      console.log(`ℹ️  Job이 이미 paused 상태입니다.`);
      console.groupEnd();
      return true; // 이미 중지되어 있으므로 성공으로 처리
    }

    // Job 상태 변경
    const pausedAt = new Date().toISOString();
    const { error } = await supabase
      .from("scraping_jobs")
      .update({
        status: newStatus,
        updated_at: pausedAt,
      })
      .eq("id", jobId);

    if (error) {
      console.error("❌ Job 중지 실패:", error);
      console.groupEnd();
      return false;
    }

    console.log(`✅ Job 중지 완료`);
    console.log(`   중지 시점: ${pausedAt}`);
    console.log(`   현재 수집된 상품: ${jobInfo.currentCount}개`);
    console.groupEnd();

    return true;
  } catch (error) {
    console.error("❌ Job 중지 중 오류:", error);
    console.groupEnd();
    return false;
  }
}

/**
 * Job 재개 (이어서 수집)
 *
 * @param jobId - Job ID
 * @returns 재개 성공 여부
 */
export async function resumeJob(jobId: string): Promise<boolean> {
  console.group(`▶️  [Sequential Scraper] Job ${jobId} 재개 요청 (이어서 수집)`);

  try {
    const supabase = getServiceRoleClient();

    // Job 상태 확인
    const jobInfo = await getJobInfo(jobId);
    if (!jobInfo) {
      console.error("❌ Job을 찾을 수 없습니다");
      console.groupEnd();
      return false;
    }

    // paused 상태만 재개 가능
    if (jobInfo.status !== "paused") {
      console.warn(`⚠️  Job이 ${jobInfo.status} 상태입니다. paused 상태만 재개할 수 있습니다.`);
      console.groupEnd();
      return false;
    }

    // Job 상태를 'running'으로 변경
    const resumedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("scraping_jobs")
      .update({
        status: "running",
        updated_at: resumedAt,
      })
      .eq("id", jobId);

    if (updateError) {
      console.error("❌ Job 상태 업데이트 실패:", updateError);
      console.groupEnd();
      return false;
    }

    // paused 상태일 때 프로세스가 완전히 종료되므로, 재개 시 다시 시작해야 함
    // 백그라운드에서 processSequentialScraping을 다시 시작 (이어서 수집)
    processSequentialScraping(jobId, jobInfo.userId, jobInfo.searchInput, jobInfo.totalTarget).catch(
      (error) => {
        console.error("❌ 순차 처리 재개 중 예상치 못한 오류:", error);
        // Job 상태를 'failed'로 업데이트
        updateJobStatus(jobId, "failed", error.message).catch((updateError) => {
          console.error("❌ Job 상태 업데이트 실패:", updateError);
        });
      }
    );

    console.log(`✅ Job 재개 완료`);
    console.log(`   재개 시점: ${resumedAt}`);
    console.log(`   이어서 수집: ${jobInfo.currentCount}개부터 계속`);
    console.log(`   백그라운드 프로세스 재시작됨`);
    console.groupEnd();

    return true;
  } catch (error) {
    console.error("❌ Job 재개 중 오류:", error);
    console.groupEnd();
    return false;
  }
}

/**
 * Job 재시작 (처음부터 다시 수집)
 *
 * @param jobId - Job ID
 * @returns 재시작 성공 여부
 */
export async function restartJob(jobId: string): Promise<boolean> {
  console.group(`🔄 [Sequential Scraper] Job ${jobId} 재시작 요청 (처음부터 다시)`);

  try {
    const supabase = getServiceRoleClient();

    // Job 상태 확인
    const jobInfo = await getJobInfo(jobId);
    if (!jobInfo) {
      console.error("❌ Job을 찾을 수 없습니다");
      console.groupEnd();
      return false;
    }

    // paused 또는 cancelled 상태만 재시작 가능
    if (jobInfo.status !== "paused" && jobInfo.status !== "cancelled") {
      console.warn(`⚠️  Job이 ${jobInfo.status} 상태입니다. paused 또는 cancelled 상태만 재시작할 수 있습니다.`);
      console.groupEnd();
      return false;
    }

    // 기존 루프를 취소하기 위해 상태를 cancelled로 변경 후 즉시 running으로 변경
    // (기존 루프는 cancelled 상태를 감지하고 종료됨)
    const restartedAt = new Date().toISOString();
    
    // 먼저 cancelled로 변경하여 기존 루프 종료
    await supabase
      .from("scraping_jobs")
      .update({
        status: "cancelled",
        updated_at: restartedAt,
      })
      .eq("id", jobId);

    // 잠시 대기 (기존 루프가 종료될 시간 확보)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 카운트 초기화 및 상태를 'running'으로 변경
    const { error } = await supabase
      .from("scraping_jobs")
      .update({
        status: "running",
        current_count: 0,
        success_count: 0,
        failed_count: 0,
        started_at: restartedAt,
        completed_at: null,
        error_message: null,
        updated_at: restartedAt,
      })
      .eq("id", jobId);

    if (error) {
      console.error("❌ Job 재시작 실패:", error);
      console.groupEnd();
      return false;
    }

    // processSequentialScraping 재시작 (처음부터)
    // 백그라운드에서 비동기로 실행
    processSequentialScraping(
      jobId,
      jobInfo.userId,
      jobInfo.searchInput,
      jobInfo.totalTarget
    ).catch((error) => {
      console.error("❌ Job 재시작 후 처리 중 오류:", error);
    });

    console.log(`✅ Job 재시작 완료`);
    console.log(`   재시작 시점: ${restartedAt}`);
    console.log(`   처음부터 다시 수집 시작`);
    console.groupEnd();

    return true;
  } catch (error) {
    console.error("❌ Job 재시작 중 오류:", error);
    console.groupEnd();
    return false;
  }
}
