/**
 * @file app/api/scrape/[jobId]/stream/route.ts
 * @description 스크래핑 Job 진행 상황 SSE 스트리밍 API
 *
 * 이 API는 Server-Sent Events (SSE)를 사용하여 Job 진행 상황을 실시간으로 스트리밍합니다.
 *
 * Endpoint: GET /api/scrape/[jobId]/stream
 *
 * Response: text/event-stream
 * 각 이벤트는 JSON 형식으로 진행 상황을 전송합니다.
 */

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getJobProgress, getJobInfo } from "@/lib/scraper/sequential-scraper";

/**
 * GET 요청 핸들러
 * SSE 스트림으로 Job 진행 상황 전송
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  console.group("📡 [API] SSE 스트림 시작");

  try {
    // 1. 사용자 인증 확인
    const { userId } = await auth();

    if (!userId) {
      console.error("❌ 인증되지 않은 사용자");
      console.groupEnd();

      return new Response(
        `data: ${JSON.stringify({ error: "인증이 필요합니다." })}\n\n`,
        {
          status: 401,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    // 2. Job ID 파라미터 추출
    const { jobId } = await params;
    console.log(`🔍 Job ID: ${jobId}`);

    if (!jobId) {
      console.error("❌ Job ID가 없습니다");
      console.groupEnd();

      return new Response(
        `data: ${JSON.stringify({ error: "Job ID가 필요합니다." })}\n\n`,
        {
          status: 400,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    // 3. 사용자 권한 확인
    const jobInfo = await getJobInfo(jobId);

    if (!jobInfo) {
      console.error("❌ Job을 찾을 수 없습니다");
      console.groupEnd();

      return new Response(
        `data: ${JSON.stringify({ error: "Job을 찾을 수 없습니다." })}\n\n`,
        {
          status: 404,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    if (jobInfo.userId !== userId) {
      console.error("❌ 권한이 없습니다");
      console.groupEnd();

      return new Response(
        `data: ${JSON.stringify({ error: "이 Job에 대한 권한이 없습니다." })}\n\n`,
        {
          status: 403,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    console.log("✅ SSE 스트림 시작");
    console.groupEnd();

    // 4. SSE 스트림 생성
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let isActive = true;

        // 정리 함수
        const cleanup = () => {
          isActive = false;
          controller.close();
        };

        // 클라이언트 연결 종료 감지
        request.signal.addEventListener("abort", cleanup);

        // 주기적으로 진행 상황 전송 (5초마다)
        const interval = setInterval(async () => {
          if (!isActive) {
            clearInterval(interval);
            return;
          }

          try {
            const progress = await getJobProgress(jobId);

            if (!progress) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: "진행 상황을 조회할 수 없습니다." })}\n\n`
                )
              );
              cleanup();
              return;
            }

            // 진행 상황 전송
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(progress)}\n\n`)
            );

            // 완료 또는 실패 시 스트림 종료
            if (
              progress.status === "completed" ||
              progress.status === "failed" ||
              progress.status === "cancelled"
            ) {
              clearInterval(interval);
              cleanup();
            }
          } catch (error) {
            console.error("❌ 진행 상황 조회 실패:", error);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  error:
                    error instanceof Error
                      ? error.message
                      : "진행 상황 조회 중 오류가 발생했습니다.",
                })}\n\n`
              )
            );
            cleanup();
          }
        }, 5000); // 5초마다 전송

        // 즉시 한 번 전송
        try {
          const initialProgress = await getJobProgress(jobId);
          if (initialProgress) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(initialProgress)}\n\n`)
            );
          }
        } catch (error) {
          console.error("❌ 초기 진행 상황 조회 실패:", error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Nginx 버퍼링 비활성화
      },
    });
  } catch (error) {
    console.error("❌ SSE 스트림 생성 중 오류:", error);
    console.groupEnd();

    return new Response(
      `data: ${JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "SSE 스트림 생성 중 오류가 발생했습니다.",
      })}\n\n`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }
}
