/**
 * @file lib/debug-db-data.ts
 * @description DB 데이터 확인 및 정리 스크립트
 * 
 * 실행 방법:
 * npx tsx lib/debug-db-data.ts
 */

import { getServiceRoleClient } from "@/lib/supabase/service-role";

async function main() {
  console.group("🔍 DB 데이터 확인");

  const supabase = getServiceRoleClient();

  // 1. 전체 개수 확인
  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  console.log(`📊 총 상품 개수: ${count}개`);

  // 2. 최근 5개 데이터 조회
  const { data, error } = await supabase
    .from("products")
    .select("asin, title, amazon_price, margin_rate, selling_price, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("❌ 조회 실패:", error);
    return;
  }

  console.log("\n📋 최근 5개 상품:");
  data?.forEach((product, index) => {
    console.log(`\n${index + 1}. ${product.asin}`);
    console.log(`   제목: ${product.title.substring(0, 60)}...`);
    console.log(`   아마존 가격: $${product.amazon_price}`);
    console.log(`   마진율: ${product.margin_rate}%`);
    console.log(`   판매가: $${product.selling_price}`);
  });

  // 3. 비정상적인 가격 확인
  const { data: abnormalData } = await supabase
    .from("products")
    .select("asin, title, amazon_price, selling_price")
    .or("amazon_price.gt.10000,selling_price.gt.10000");

  if (abnormalData && abnormalData.length > 0) {
    console.log(`\n⚠️  비정상적인 가격 데이터: ${abnormalData.length}개`);
    abnormalData.forEach((product) => {
      console.log(`   ${product.asin}: $${product.amazon_price} → $${product.selling_price}`);
    });
  }

  console.groupEnd();
}

main().catch(console.error);
