/**
 * @file lib/verify-tables.ts
 * @description 테이블 생성 및 초기 데이터 확인 스크립트
 */

import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";

async function verifyTables() {
  console.log("📊 테이블 생성 확인 중...\n");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Products 테이블 확인
  console.log("1️⃣ Products 테이블 확인");
  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  if (productsError) {
    console.error("❌ Products 테이블 접근 실패:", productsError.message);
  } else {
    console.log("✅ Products 테이블 생성됨");
    console.log(`   레코드 수: ${productsData?.length || 0}\n`);
  }

  // Banned Keywords 테이블 확인
  console.log("2️⃣ Banned Keywords 테이블 확인");
  const { data: keywordsData, error: keywordsError } = await supabase
    .from("banned_keywords")
    .select("keyword");

  if (keywordsError) {
    console.error(
      "❌ Banned Keywords 테이블 접근 실패:",
      keywordsError.message
    );
  } else {
    console.log("✅ Banned Keywords 테이블 생성됨");
    console.log(`   레코드 수: ${keywordsData?.length || 0}`);
    console.log(`   금지어 목록:`);
    keywordsData?.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.keyword}`);
    });
  }

  console.log("\n🎉 테이블 검증 완료!");
}

verifyTables();




