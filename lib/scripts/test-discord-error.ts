/**
 * @file lib/scripts/test-discord-error.ts
 * @description Discord 오류 알림 테스트 스크립트
 * 
 * 스크래핑 오류 상황을 가정한 테스트 메시지를 Discord로 전송합니다.
 */

import "dotenv/config";
import { sendDiscord } from "@/lib/discord";

async function testErrorNotifications() {
  console.log("🔔 Discord 오류 알림 테스트 시작...\n");

  // 테스트용 Job ID
  const testJobId = "test-job-" + Date.now();
  const totalTarget = 1000;
  const currentCount = 150;

  // 1. 개별 상품 수집 오류 테스트
  console.log("1️⃣ 개별 상품 수집 오류 알림 테스트...");
  await sendDiscord({
    content: `❌ 스크래핑 오류 발생\n` +
      `Job ID: ${testJobId}\n` +
      `오류: 상품 정보를 가져올 수 없습니다 (ASIN: B08XYZ123)\n` +
      `현재 진행: ${currentCount}/${totalTarget}`
  });
  console.log("✅ 개별 오류 알림 전송 완료\n");

  // 2초 대기
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. 전체 작업 실패 알림 테스트
  console.log("2️⃣ 전체 작업 실패 알림 테스트...");
  await sendDiscord({
    content: `🚨 스크래핑 작업 전체 실패\n` +
      `Job ID: ${testJobId}\n` +
      `오류: 네트워크 연결 오류로 인해 작업이 중단되었습니다.\n` +
      `작업이 중단되었습니다.`
  });
  console.log("✅ 전체 실패 알림 전송 완료\n");

  // 2초 대기
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. 다양한 오류 시나리오 테스트
  console.log("3️⃣ 다양한 오류 시나리오 테스트...");
  
  const errorScenarios = [
    {
      title: "타임아웃 오류",
      error: "요청 시간 초과: 서버 응답이 30초를 초과했습니다."
    },
    {
      title: "파싱 오류",
      error: "HTML 파싱 실패: 예상하지 못한 페이지 구조입니다."
    },
    {
      title: "재시도 초과",
      error: "최대 재시도 횟수(3회) 초과: 상품 정보를 가져올 수 없습니다."
    }
  ];

  for (const scenario of errorScenarios) {
    await sendDiscord({
      content: `❌ 스크래핑 오류 발생\n` +
        `Job ID: ${testJobId}\n` +
        `오류: [${scenario.title}] ${scenario.error}\n` +
        `현재 진행: ${currentCount}/${totalTarget}`
    });
    console.log(`✅ ${scenario.title} 알림 전송 완료`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("\n🎉 모든 테스트 메시지 전송 완료!");
  console.log("Discord 채널에서 메시지를 확인해주세요.");
}

testErrorNotifications().catch(console.error);

