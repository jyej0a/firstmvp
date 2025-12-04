/**
 * @file lib/scraper/test-puppeteer.ts
 * @description Puppeteer 설치 및 기본 동작 확인 테스트 스크립트
 *
 * 이 스크립트는 Puppeteer가 정상적으로 설치되었는지 확인하고,
 * 기본적인 브라우저 실행 및 페이지 로딩이 가능한지 테스트합니다.
 */

import puppeteer from "puppeteer";

async function testPuppeteer() {
  console.group("🧪 Puppeteer 설치 확인 테스트");
  console.log("테스트 시작...\n");

  let browser = null;

  try {
    // 1. 브라우저 실행
    console.log("1️⃣ 브라우저 실행 중...");
    browser = await puppeteer.launch({
      headless: true, // 백그라운드 실행
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    console.log("✅ 브라우저 실행 성공\n");

    // 2. 새 페이지 열기
    console.log("2️⃣ 새 페이지 생성 중...");
    const page = await browser.newPage();
    console.log("✅ 페이지 생성 성공\n");

    // 3. User-Agent 설정 (Bot Detection 회피)
    console.log("3️⃣ User-Agent 설정 중...");
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    console.log("✅ User-Agent 설정 성공\n");

    // 4. 테스트 페이지 접속
    console.log("4️⃣ 테스트 페이지 접속 중...");
    console.log("   URL: https://example.com");
    await page.goto("https://example.com", {
      waitUntil: "networkidle2", // 네트워크가 안정될 때까지 대기
      timeout: 30000, // 30초 타임아웃
    });
    console.log("✅ 페이지 접속 성공\n");

    // 5. 페이지 제목 추출
    console.log("5️⃣ 페이지 정보 추출 중...");
    const title = await page.title();
    const url = page.url();
    console.log(`   제목: ${title}`);
    console.log(`   URL: ${url}`);
    console.log("✅ 정보 추출 성공\n");

    // 6. 스크린샷 저장 (선택사항)
    // await page.screenshot({ path: 'test-screenshot.png' });

    console.log("🎉 모든 테스트 통과!");
    console.log("\n✨ Puppeteer가 정상적으로 설치되어 있습니다.");
    console.log("✨ 아마존 스크래핑 기능을 구현할 준비가 완료되었습니다.");
  } catch (error) {
    console.error("\n❌ 테스트 실패!");
    console.error("에러 내용:", error);

    if (error instanceof Error) {
      console.error("\n📋 에러 상세:");
      console.error(`   메시지: ${error.message}`);
      console.error(`   스택: ${error.stack}`);
    }

    process.exit(1);
  } finally {
    // 브라우저 종료
    if (browser) {
      await browser.close();
      console.log("\n🔚 브라우저 종료 완료");
    }
    console.groupEnd();
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  testPuppeteer();
}

export { testPuppeteer };
