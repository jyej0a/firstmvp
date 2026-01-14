/**
 * @file hooks/use-scraping-progress.ts
 * @description 스크래핑 진행 상황 조회 React Hook
 *
 * 이 Hook은 Supabase Realtime을 사용하여 이벤트 기반으로 Job 진행 상황을 조회합니다.
 * 데이터베이스에 변경이 발생했을 때만 업데이트됩니다.
 *
 * @example
 * const { progress, isLoading, error } = useScrapingProgress(jobId);
 * if (progress) {
 *   console.log(`진행률: ${progress.progressPercentage}%`);
 * }
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useClerkSupabaseClient } from "@/lib/supabase/clerk-client";
import type { JobProgress } from "@/lib/scraper/sequential-scraper";

/**
 * 진행 상황 조회 결과 인터페이스
 */
export interface UseScrapingProgressResult {
  /** 진행 상황 정보 (null이면 아직 조회 전) */
  progress: JobProgress | null;

  /** 로딩 중 여부 */
  isLoading: boolean;

  /** 에러 메시지 (null이면 에러 없음) */
  error: string | null;

  /** 수동으로 새로고침하는 함수 */
  refetch: () => void;
}

/**
 * 스크래핑 진행 상황 조회 Hook
 *
 * @param jobId - Job ID (null이면 조회하지 않음)
 * @param pollingInterval - Polling 간격 (밀리초, 기본값: 5000 = 5초)
 * @param apiPath - API 경로 (기본값: '/api/scrape', v2는 '/api/scrape-v2')
 * @returns 진행 상황 정보 및 상태
 */
export function useScrapingProgress(
  jobId: string | null,
  pollingInterval: number = 5000, // 폴백용 (Realtime 실패 시 사용)
  apiPath: string = '/api/scrape'
): UseScrapingProgressResult {
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useClerkSupabaseClient();
  const channelRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 진행 상황 조회 함수
   */
  const fetchProgress = async () => {
    if (!jobId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiPath}/${jobId}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "진행 상황 조회 실패");
      }

      setProgress(data.data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "진행 상황 조회 중 오류가 발생했습니다.";
      setError(errorMessage);
      console.error("❌ 진행 상황 조회 실패:", err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 수동 새로고침 함수
   */
  const refetch = () => {
    fetchProgress();
  };

  // Job ID가 변경되거나 컴포넌트 마운트 시 이벤트 구독 시작
  useEffect(() => {
    if (!jobId) {
      return;
    }

    // 즉시 한 번 조회
    fetchProgress();

    // Supabase Realtime 구독 (이벤트 기반)
    const channel = supabase
      .channel(`scraping-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scraping_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          console.log('📡 [Realtime] Job 상태 변경 감지:', payload.new);
          // 데이터베이스 변경 시 최신 데이터 조회
          fetchProgress();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] 구독 시작:', jobId);
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ [Realtime] 구독 실패, 폴링으로 폴백');
          // Realtime 실패 시 폴링으로 폴백
    intervalRef.current = setInterval(() => {
      fetchProgress();
    }, pollingInterval);
        }
      });

    channelRef.current = channel;

    // 정리 함수: 컴포넌트 언마운트 시 또는 jobId 변경 시 구독 해제
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, pollingInterval, apiPath, supabase]);

  // Job이 완료되거나 중지되면 구독 해제
  useEffect(() => {
    if (progress && (
      progress.status === "completed" || 
      progress.status === "failed" || 
      progress.status === "cancelled" ||
      progress.status === "paused"
    )) {
      // 구독 해제
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // 폴링도 중지
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [progress, supabase]);

  return {
    progress,
    isLoading,
    error,
    refetch,
  };
}
