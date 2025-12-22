import "dotenv/config"; // ✅ .env 자동 로드

const url = process.env.DISCORD_WEBHOOK_URL;

async function test() {
  if (!url) {
    console.error("DISCORD_WEBHOOK_URL not found");
    return;
  }

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: "✅ Discord Webhook 연결 테스트 성공",
    }),
  });

  console.log("sent");
}

test();
