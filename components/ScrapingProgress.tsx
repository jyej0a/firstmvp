/**
 * @file components/ScrapingProgress.tsx
 * @description 스크래핑 진행 상황 표시 컴포넌트
 *
 * 이 컴포넌트는 스크래핑 Job의 진행 상황을 시각적으로 표시합니다.
 *
 * 주요 기능:
 * - 진행률 바
 * - 현재/목표 개수
 * - 예상 남은 시간
 * - 성공/실패 개수
 */

"use client";

import { useEffect, useState } from "react";
import { useScrapingProgress } from "@/hooks/use-scraping-progress";
import { Loader2, CheckCircle2, XCircle, Clock, Square, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * ScrapingProgress 컴포넌트 Props
 */
export interface ScrapingProgressProps {
  /** Job ID */
  jobId: string;

  /** Polling 간격 (밀리초, 기본값: 5000) */
  pollingInterval?: number;

  /** API 경로 (기본값: '/api/scrape', v2는 '/api/scrape-v2') */
  apiPath?: string;

  /** 완료 시 콜백 함수 */
  onComplete?: () => void;
}

/**
 * 시간 포맷팅 함수
 *
 * @param seconds - 초 단위 시간
 * @returns 포맷팅된 시간 문자열 (예: "1시간 30분 45초")
 */
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}초`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours}시간`);
  }
  
  if (minutes > 0) {
    parts.push(`${minutes}분`);
  }
  
  // 초는 항상 표시 (1분 이상이어도)
  parts.push(`${secs}초`);

  return parts.join(' ');
}

/**
 * 스크래핑 진행 상황 표시 컴포넌트
 */
export default function ScrapingProgress({
  jobId,
  pollingInterval = 5000,
  apiPath = '/api/scrape',
  onComplete,
}: ScrapingProgressProps) {
  const { progress, isLoading, error, refetch } = useScrapingProgress(jobId, pollingInterval, apiPath);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0); // 초 단위

  // 실 소요시간 계산 (초 단위로 업데이트)
  useEffect(() => {
    if (!progress?.startedAt) {
      setElapsedTime(0);
      return;
    }

    const updateElapsedTime = () => {
      const startTime = new Date(progress.startedAt!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000); // 초 단위
      setElapsedTime(elapsed);
    };

    // 즉시 한 번 계산
    updateElapsedTime();

    // 1초마다 업데이트
    const interval = setInterval(updateElapsedTime, 1000);

    return () => clearInterval(interval);
  }, [progress?.startedAt]);

  // 완료 시 콜백 호출 (useEffect로 한 번만 호출되도록 처리)
  useEffect(() => {
    if (progress && (progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled") && onComplete) {
      onComplete();
    }
  }, [progress?.status, onComplete]);

  // Job 취소 핸들러
  const handleCancel = async () => {
    if (!confirm("수집 작업을 중단하시겠습니까? 진행 중인 작업은 저장되지만 이후 작업은 중단됩니다.")) {
      return;
    }

    setIsCancelling(true);

    try {
      const response = await fetch(`${apiPath}/${jobId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Job 취소에 실패했습니다.");
      }

      console.log("✅ Job 취소 완료");
      refetch(); // 상태 새로고침
    } catch (error) {
      console.error("❌ Job 취소 실패:", error);
      alert(error instanceof Error ? error.message : "Job 취소에 실패했습니다.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Job 일시 중지 핸들러
  const handlePause = async () => {
    setIsPausing(true);

    try {
      const response = await fetch(`${apiPath}/${jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "pause" }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Job 중지에 실패했습니다.");
      }

      console.log("✅ Job 중지 완료");
      refetch(); // 상태 새로고침
    } catch (error) {
      console.error("❌ Job 중지 실패:", error);
      alert(error instanceof Error ? error.message : "Job 중지에 실패했습니다.");
    } finally {
      setIsPausing(false);
    }
  };

  // Job 재개 핸들러 (이어서 수집)
  const handleResume = async (restart: boolean = false) => {
    setIsResuming(true);
    setShowResumeDialog(false);

    try {
      const response = await fetch(`${apiPath}/${jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "resume",
          resumeMode: restart ? "restart" : "continue",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Job 재개에 실패했습니다.");
      }

      console.log(`✅ Job 재개 완료 (${restart ? "처음부터 다시" : "이어서 수집"})`);
      refetch(); // 상태 새로고침
    } catch (error) {
      console.error("❌ Job 재개 실패:", error);
      alert(error instanceof Error ? error.message : "Job 재개에 실패했습니다.");
    } finally {
      setIsResuming(false);
    }
  };

  // 로딩 중
  if (isLoading && !progress) {
    return (
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <h3 className="font-semibold">진행 상황 조회 중...</h3>
        </div>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="border rounded-lg p-4 bg-card border-destructive">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <h3 className="font-semibold">오류 발생</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
      </div>
    );
  }

  // 진행 상황 없음
  if (!progress) {
    return (
      <div className="border rounded-lg p-4 bg-card">
        <h3 className="font-semibold">진행 상황을 불러올 수 없습니다</h3>
      </div>
    );
  }

  // 상태별 아이콘 및 색상
  const statusConfig = {
    pending: { icon: Clock, color: "text-muted-foreground", label: "대기 중" },
    running: { icon: Loader2, color: "text-blue-500", label: "진행 중", animate: true },
    paused: { icon: Pause, color: "text-yellow-500", label: "일시 중지" },
    completed: { icon: CheckCircle2, color: "text-green-500", label: "완료" },
    failed: { icon: XCircle, color: "text-destructive", label: "실패" },
    cancelled: { icon: XCircle, color: "text-muted-foreground", label: "취소됨" },
  };

  const config = statusConfig[progress.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="border rounded-lg p-4 bg-card space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <StatusIcon
            className={`h-5 w-5 ${config.color} ${config.animate ? "animate-spin" : ""}`}
          />
          <h3 className="font-semibold">{config.label}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {progress.status === "running" && "상품을 순차적으로 수집하고 있습니다..."}
          {progress.status === "paused" && "수집 작업이 일시 중지되었습니다."}
          {progress.status === "completed" && "모든 상품 수집이 완료되었습니다!"}
          {progress.status === "failed" && "수집 중 오류가 발생했습니다."}
          {progress.status === "pending" && "작업이 시작되기를 기다리는 중..."}
          {progress.status === "cancelled" && "작업이 취소되었습니다."}
        </p>
      </div>

      {/* 진행률 바 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">진행률</span>
          <span className="font-medium">{progress.progressPercentage}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress.progressPercentage}%` }}
          />
        </div>
      </div>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">수집된 상품</div>
            <div className="text-2xl font-bold">
              {progress.currentCount} / {progress.totalTarget}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">실 소요시간</div>
            <div className="text-2xl font-bold">
              {progress.startedAt && elapsedTime > 0
                ? formatTime(elapsedTime)
                : "-"}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">예상 남은 시간</div>
            <div className="text-2xl font-bold">
              {progress.status === "running" && progress.estimatedTimeRemaining > 0
                ? formatTime(progress.estimatedTimeRemaining)
                : "-"}
            </div>
          </div>
        </div>

      {/* 성공/실패 개수 */}
      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
        <div>
          <div className="text-sm text-muted-foreground">성공</div>
          <div className="text-xl font-semibold text-green-600">
            {progress.successCount}개
          </div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">실패</div>
          <div className="text-xl font-semibold text-destructive">
            {progress.failedCount}개
          </div>
        </div>
      </div>

      {/* 버튼 영역 */}
      <div className="pt-2 border-t space-y-2">
        {/* 진행 중일 때: 일시 중지 버튼 */}
        {progress.status === "running" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            disabled={isPausing}
            className="w-full"
          >
            {isPausing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                중지 중...
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                수집 중지
              </>
            )}
          </Button>
        )}

        {/* 일시 중지 상태일 때: 재개 버튼 */}
        {progress.status === "paused" && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowResumeDialog(true)}
            disabled={isResuming}
            className="w-full"
          >
            {isResuming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                재개 중...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                수집 재개
              </>
            )}
          </Button>
        )}

        {/* 취소 버튼 (진행 중 또는 일시 중지 상태일 때) */}
        {(progress.status === "running" || progress.status === "paused") && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancel}
            disabled={isCancelling}
            className="w-full"
          >
            {isCancelling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                중단 중...
              </>
            ) : (
              <>
                <Square className="h-4 w-4 mr-2" />
                수집 중단
              </>
            )}
          </Button>
        )}
      </div>

      {/* 재개 옵션 선택 다이얼로그 */}
      <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>수집 재개 옵션 선택</DialogTitle>
            <DialogDescription>
              수집을 어떻게 재개하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleResume(false)}
              disabled={isResuming}
            >
              <Play className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-semibold">이어서 수집</div>
                <div className="text-xs text-muted-foreground">
                  현재 {progress.currentCount}개부터 계속 수집합니다.
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleResume(true)}
              disabled={isResuming}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-semibold">처음부터 다시 수집</div>
                <div className="text-xs text-muted-foreground">
                  카운트를 초기화하고 처음부터 다시 수집합니다.
                </div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowResumeDialog(false)}
              disabled={isResuming}
            >
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
