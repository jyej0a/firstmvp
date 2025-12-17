/**
 * @file hooks/use-scraping-progress.ts
 * @description 스크래핑 진행 상황 조회 React Hook
 *
 * 이 Hook은 Polling 방식으로 Job 진행 상황을 주기적으로 조회합니다.
 *
 * @example
 * const { progress, isLoading, error } = useScrapingProgress(jobId);
 * if (progress) {
 *   console.log(`진행률: ${progress.progressPercentage}%`);
 * }
 */

"use client";

import { useState, useEffect, useRef } from "react";
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
 * @returns 진행 상황 정보 및 상태
 */
export function useScrapingProgress(
  jobId: string | null,
  pollingInterval: number = 5000
): UseScrapingProgressResult {
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const response = await fetch(`/api/scrape/${jobId}`);
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

  // Job ID가 변경되거나 컴포넌트 마운트 시 조회 시작
  useEffect(() => {
    if (!jobId) {
      return;
    }

    // 즉시 한 번 조회
    fetchProgress();

    // Polling 시작
    intervalRef.current = setInterval(() => {
      fetchProgress();
    }, pollingInterval);

    // 정리 함수: 컴포넌트 언마운트 시 또는 jobId 변경 시 Polling 중지
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, pollingInterval]);

  // Job이 완료되면 Polling 중지
  useEffect(() => {
    if (progress && (progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled")) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [progress]);

  return {
    progress,
    isLoading,
    error,
    refetch,
  };
}
