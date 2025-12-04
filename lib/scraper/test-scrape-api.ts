/**
 * @file lib/scraper/test-scrape-api.ts
 * @description 스크래핑 API 테스트 스크립트
 *
 * 이 스크립트는 /api/scrape 엔드포인트를 직접 호출하여
 * API가 정상적으로 동작하는지 검증합니다.
 *
 * 테스트 시나리오:
 * 1. 키워드로 스크래핑 요청
 * 2. URL로 스크래핑 요청
 * 3. 잘못된 입력 처리 확인
 * 4. 응답 데이터 검증
 */

/**
 * API 테스트 실행
 */
async function testScrapeAPI() {
  console.log("=".repeat(70));
  console.log("🧪 스크래핑 API 테스트");
  console.log("=".repeat(70));
  console.log();

  const API_URL = "http://localhost:3000/api/scrape";

  // Test 1: 키워드로 스크래핑
  console.group("📝 Test 1: 키워드로 스크래핑");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        searchInput: "phone stand",
      }),
    });

    const data = await response.json();
    console.log(`✅ 상태 코드: ${response.status}`);
    console.log(`✅ 성공 여부: ${data.success}`);

    if (data.success) {
      console.log(`✅ 수집 상품: ${data.data.stats.totalScraped}개`);
      console.log(`✅ 소요 시간: ${data.data.stats.duration}ms`);
      console.log(`✅ 메시지: ${data.message}`);
      console.log(`\n📦 샘플 상품 (처음 3개):`);
      data.data.products.slice(0, 3).forEach((product: any, index: number) => {
        console.log(`   ${index + 1}. ${product.title}`);
        console.log(`      ASIN: ${product.asin}`);
        console.log(`      가격: $${product.amazonPrice}`);
      });
    } else {
      console.error(`❌ 에러: ${data.error}`);
    }
  } catch (error) {
    console.error("❌ 요청 실패:", error);
  }
  console.groupEnd();
  console.log();

  // Test 2: URL로 스크래핑
  console.group("🔗 Test 2: URL로 스크래핑");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        searchInput: "https://www.amazon.com/s?k=wireless+charger",
      }),
    });

    const data = await response.json();
    console.log(`✅ 상태 코드: ${response.status}`);
    console.log(`✅ 성공 여부: ${data.success}`);

    if (data.success) {
      console.log(`✅ 수집 상품: ${data.data.stats.totalScraped}개`);
      console.log(`✅ 메시지: ${data.message}`);
    } else {
      console.error(`❌ 에러: ${data.error}`);
    }
  } catch (error) {
    console.error("❌ 요청 실패:", error);
  }
  console.groupEnd();
  console.log();

  // Test 3: 잘못된 입력 (빈 값)
  console.group("⚠️  Test 3: 잘못된 입력 (빈 값)");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        searchInput: "",
      }),
    });

    const data = await response.json();
    console.log(`✅ 상태 코드: ${response.status} (예상: 400)`);
    console.log(`✅ 성공 여부: ${data.success} (예상: false)`);
    console.log(`✅ 에러 메시지: ${data.error}`);
  } catch (error) {
    console.error("❌ 요청 실패:", error);
  }
  console.groupEnd();
  console.log();

  // Test 4: 잘못된 URL
  console.group("⚠️  Test 4: 잘못된 URL");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        searchInput: "https://www.google.com",
      }),
    });

    const data = await response.json();
    console.log(`✅ 상태 코드: ${response.status} (예상: 400)`);
    console.log(`✅ 성공 여부: ${data.success} (예상: false)`);
    console.log(`✅ 에러 메시지: ${data.error}`);
  } catch (error) {
    console.error("❌ 요청 실패:", error);
  }
  console.groupEnd();
  console.log();

  // Test 5: GET 요청 (API 문서)
  console.group("📖 Test 5: GET 요청 (API 문서)");
  try {
    const response = await fetch(API_URL, {
      method: "GET",
    });

    const data = await response.json();
    console.log(`✅ 상태 코드: ${response.status}`);
    console.log(`✅ 메시지: ${data.message}`);
    console.log(`✅ API 사용법:`);
    console.log(JSON.stringify(data.usage, null, 2));
  } catch (error) {
    console.error("❌ 요청 실패:", error);
  }
  console.groupEnd();
  console.log();

  console.log("=".repeat(70));
  console.log("✨ 모든 테스트 완료!");
  console.log("=".repeat(70));
}

// 서버가 실행 중인지 확인
async function checkServerRunning() {
  try {
    const response = await fetch("http://localhost:3000", {
      method: "HEAD",
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 메인 실행
if (require.main === module) {
  console.log("\n💡 사용법:");
  console.log("   1. 먼저 개발 서버를 실행하세요: pnpm dev");
  console.log("   2. 새 터미널에서 테스트 실행: pnpm test:api");
  console.log();

  checkServerRunning()
    .then((isRunning) => {
      if (!isRunning) {
        console.error("❌ 개발 서버가 실행 중이지 않습니다.");
        console.error("   먼저 'pnpm dev'를 실행해 주세요.\n");
        process.exit(1);
      }

      return testScrapeAPI();
    })
    .catch((error) => {
      console.error("테스트 실행 중 오류:", error);
      process.exit(1);
    });
}

export { testScrapeAPI };

