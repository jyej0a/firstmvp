/**
 * @file scripts/test-category-taxonomy.ts
 * @description Shopify Taxonomy 카테고리 매칭 테스트
 */

import { config } from "dotenv";
import { matchCategoryToShopify } from "@/lib/utils/category-matcher";

// 환경변수 로드
config();

async function main() {
  console.log("🧪 Shopify Taxonomy 카테고리 매칭 테스트\n");
  console.log("=" .repeat(80));

  // 테스트 케이스 1: Massage Gun (ASIN: B09JBCSC7H)
  const testCategory1 =
    "Health & Household > Wellness & Relaxation > Massage Tools & Equipment > Electric Massagers > Handheld Massagers";

  console.log(`\n📦 테스트 1: ${testCategory1}\n`);

  const result1 = await matchCategoryToShopify(testCategory1);

  console.log("\n📊 매칭 결과:");
  console.log(JSON.stringify(result1, null, 2));

  console.log("\n" + "=".repeat(80));

  // 테스트 케이스 2: Lipstick (ASIN: B0G6419DPJ)
  const testCategory2 =
    "Beauty & Personal Care > Makeup > Face > Lips > Lipstick";

  console.log(`\n📦 테스트 2: ${testCategory2}\n`);

  const result2 = await matchCategoryToShopify(testCategory2);

  console.log("\n📊 매칭 결과:");
  console.log(JSON.stringify(result2, null, 2));

  console.log("\n" + "=".repeat(80));

  // 테스트 케이스 3: Electronics
  const testCategory3 =
    "Electronics > Computers & Accessories > Computer Accessories & Peripherals > Keyboards";

  console.log(`\n📦 테스트 3: ${testCategory3}\n`);

  const result3 = await matchCategoryToShopify(testCategory3);

  console.log("\n📊 매칭 결과:");
  console.log(JSON.stringify(result3, null, 2));

  console.log("\n✅ 테스트 완료!");
}

main().catch((error) => {
  console.error("❌ 테스트 실패:", error);
  process.exit(1);
});
