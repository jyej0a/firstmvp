/**
 * @file discord.ts
 * @description Discord Webhook 메시지 전송 유틸리티
 *
 * 이 파일은 서버 전용 코드입니다.
 * 클라이언트 컴포넌트에서 import하지 마세요.
 * Server Components, Server Actions, API Routes에서만 사용 가능합니다.
 */

/**
 * Discord Webhook으로 메시지를 전송합니다.
 *
 * @param payload - 전송할 메시지 페이로드
 * @param payload.content - Discord에 전송할 메시지 내용 (선택사항)
 *
 * @example
 * ```ts
 * await sendDiscord({ content: "알림 메시지" });
 * ```
 */
export async function sendDiscord(payload: { content?: string }): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error("[Discord] DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다.");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "응답을 읽을 수 없습니다");
      console.error(
        `[Discord] 메시지 전송 실패: ${response.status} ${response.statusText}`,
        errorText
      );
      return;
    }
  } catch (error) {
    console.error("[Discord] 메시지 전송 중 오류 발생:", error);
  }
}

