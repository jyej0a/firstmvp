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
import { Loader2, CheckCircle2, XCircle, Clock, Square, Pause, Play } from "lucide-react";
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
  const [elapsedTime, setElapsedTime] = useState<number>(0); // 초 단위
  const [showStopDialog, setShowStopDialog] = useState(false); // 중지 선택 Dialog
  const [pausedAt, setPausedAt] = useState<number | null>(null); // 일시 중지 시점 (timestamp)
  const [totalPausedDuration, setTotalPausedDuration] = useState<number>(0); // 누적 일시 중지 시간 (초)

  // 디버그: progress 객체 출력
  useEffect(() => {
    if (progress) {
      console.log("📊 [ScrapingProgress] progress 객체:", {
        status: progress.status,
        currentCount: progress.currentCount,
        totalTarget: progress.totalTarget,
        successCount: progress.successCount,
        failedCount: progress.failedCount,
        progressPercentage: progress.progressPercentage,
      });
    }
  }, [progress]);

  // 일시 중지/재개 시 누적 시간 관리
  useEffect(() => {
    if (!progress) return;

    // paused 상태가 되면 현재 시간 기록
    if (progress.status === "paused" && pausedAt === null) {
      setPausedAt(Date.now());
    }

    // running 상태가 되면 (resume) 일시 중지된 시간 누적
    if (progress.status === "running" && pausedAt !== null) {
      const pausedDuration = Math.floor((Date.now() - pausedAt) / 1000);
      setTotalPausedDuration(prev => prev + pausedDuration);
      setPausedAt(null);
    }
  }, [progress?.status, pausedAt]);

  // 실 소요시간 계산 (초 단위로 업데이트)
  useEffect(() => {
    if (!progress?.startedAt) {
      setElapsedTime(0);
      setTotalPausedDuration(0);
      setPausedAt(null);
      return;
    }

    const updateElapsedTime = () => {
      const startTime = new Date(progress.startedAt!).getTime();
      const now = Date.now();
      const totalElapsed = Math.floor((now - startTime) / 1000); // 전체 경과 시간 (초)
      const actualElapsed = totalElapsed - totalPausedDuration; // 실제 실행 시간 (일시 중지 시간 제외)
      setElapsedTime(actualElapsed);
    };

    // ✅ running 상태일 때만 시간 계산 및 업데이트
    if (progress.status === "running") {
      // 즉시 한 번 계산
      updateElapsedTime();
      
      // 1초마다 업데이트
      const interval = setInterval(updateElapsedTime, 1000);
      return () => clearInterval(interval);
    }

    // ⏸️ paused 상태에서는 시간 계산 중단 (현재 elapsedTime 유지)
    // ✅ completed, failed, cancelled 상태에서는 최종 시간 한 번만 계산
    if (progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled") {
      updateElapsedTime();
    }
  }, [progress?.startedAt, progress?.status, totalPausedDuration]);

  // 완료 시 콜백 호출 (useEffect로 한 번만 호출되도록 처리)
  useEffect(() => {
    if (progress && (progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled") && onComplete) {
      onComplete();
    }
  }, [progress?.status, onComplete]);

  // 중지 Dialog 열기
  const handleStopClick = () => {
    setShowStopDialog(true);
  };

  // 완전 중지 핸들러
  const handleCancelConfirm = async () => {
    setIsCancelling(true);
    setShowStopDialog(false);

    try {
      const response = await fetch(`${apiPath}/${jobId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "작업 중단에 실패했습니다.");
      }

      console.log("✅ 작업 완전 중지 완료");
      refetch(); // 상태 새로고침
    } catch (error) {
      console.error("❌ 작업 중단 실패:", error);
      alert(error instanceof Error ? error.message : "작업 중단에 실패했습니다.");
    } finally {
      setIsCancelling(false);
    }
  };

  // 일시 중지 핸들러
  const handlePauseConfirm = async () => {
    setIsPausing(true);
    setShowStopDialog(false);

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
        throw new Error(data.error || "일시 중지에 실패했습니다.");
      }

      console.log("✅ 일시 중지 완료");
      refetch(); // 상태 새로고침
    } catch (error) {
      console.error("❌ 일시 중지 실패:", error);
      alert(error instanceof Error ? error.message : "일시 중지에 실패했습니다.");
    } finally {
      setIsPausing(false);
    }
  };

  // 재개 핸들러 (이어서 수집)
  const handleResume = async () => {
    setIsResuming(true);

    try {
      const response = await fetch(`${apiPath}/${jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "resume",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "재개에 실패했습니다.");
      }

      console.log("✅ 재개 완료 (이어서 수집)");
      refetch(); // 상태 새로고침
    } catch (error) {
      console.error("❌ 재개 실패:", error);
      alert(error instanceof Error ? error.message : "재개에 실패했습니다.");
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
  const statusConfig: Record<string, { icon: any; color: string; label: string; animate?: boolean }> = {
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
            {progress.successCount ?? 0}개
          </div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">실패</div>
          <div className="text-xl font-semibold text-destructive">
            {progress.failedCount ?? 0}개
          </div>
        </div>
      </div>

      {/* 버튼 영역 */}
      <div className="pt-2 border-t space-y-2">
        {/* 진행 중일 때: 중지 버튼 */}
        {progress.status === "running" && (
          <Button
            variant="destructive"
            size="lg"
            onClick={handleStopClick}
            disabled={isPausing || isCancelling}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-base py-6"
          >
            <Square className="h-5 w-5 mr-2" />
            수집 중지
          </Button>
        )}

        {/* 일시 중지 상태일 때: 재개 버튼 */}
        {progress.status === "paused" && (
          <Button
            variant="default"
            size="lg"
            onClick={handleResume}
            disabled={isResuming}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-base py-6"
          >
            {isResuming ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                재개 중...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                재개 (이어서 수집)
              </>
            )}
          </Button>
        )}
      </div>

      {/* 중지 선택 Dialog */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">수집 중지</DialogTitle>
            <DialogDescription className="text-base">
              어떤 방식으로 중지하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Pause className="h-4 w-4" />
                일시 정지
              </h4>
              <p className="text-sm text-muted-foreground">
                현재 진행 상황을 저장하고 일시 중지합니다. 나중에 이어서 수집할 수 있습니다.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Square className="h-4 w-4" />
                완전 중지
              </h4>
              <p className="text-sm text-muted-foreground">
                수집을 완전히 중단합니다. 이미 수집된 상품은 유지되지만, 재개할 수 없습니다.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => handlePauseConfirm()}
              disabled={isPausing || isCancelling}
              className="w-full sm:w-auto bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-500 text-yellow-900 font-semibold"
            >
              {isPausing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  일시 정지 중...
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  일시 정지
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleCancelConfirm()}
              disabled={isPausing || isCancelling}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  완전 중지 중...
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  완전 중지
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
