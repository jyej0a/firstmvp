/**
 * @file scripts/test-category-match.ts
 * @description 카테고리 매칭 시스템 테스트 스크립트
 *
 * 사용법:
 *   pnpm tsx scripts/test-category-match.ts "Electronics > Computers > Laptops"
 *   또는
 *   pnpm tsx scripts/test-category-match.ts
 */

// 환경변수 로드
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { matchCategoryToShopify } from "../lib/utils/category-matcher";

async function main() {
  // 명령줄 인자에서 카테고리 가져오기
  const category = process.argv[2] || "Electronics > Computers > Laptops";

  console.log("=".repeat(60));
  console.log("🔍 카테고리 매칭 테스트");
  console.log("=".repeat(60));
  console.log(`입력 카테고리: ${category}\n`);

  try {
    const startTime = Date.now();
    const result = await matchCategoryToShopify(category);
    const duration = Date.now() - startTime;

    console.log("\n" + "=".repeat(60));
    console.log("📊 테스트 결과");
    console.log("=".repeat(60));
    console.log(JSON.stringify(result, null, 2));
    console.log(`\n⏱️  소요 시간: ${duration}ms`);

    if (result.success) {
      console.log("\n✅ 매칭 성공!");
      console.log(`   쇼피파이 카테고리: ${result.shopifyCategoryName}`);
      console.log(`   카테고리 ID: ${result.shopifyCategoryId}`);
      console.log(`   신뢰도: ${((result.confidence || 0) * 100).toFixed(1)}%`);
      console.log(`   매칭 방법: ${result.matchMethod}`);
    } else {
      console.log("\n❌ 매칭 실패");
      console.log(`   에러: ${result.error}`);
    }
  } catch (error) {
    console.error("\n❌ 테스트 중 오류 발생:", error);
    process.exit(1);
  }
}

main();

