/**
 * @file lib/test-env-connection.ts
 * @description 환경변수 및 Supabase 연결 테스트 스크립트
 * 
 * 이 스크립트는 다음을 확인합니다:
 * 1. 환경변수가 제대로 로드되는지
 * 2. Supabase 연결이 정상인지
 * 3. 기본 쿼리가 작동하는지
 */

// .env 파일 로드
import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";

async function testEnvironmentAndConnection() {
  console.group("🧪 환경변수 및 Supabase 연결 테스트");
  console.log("테스트 시작...\n");

  // ============================================================================
  // 1단계: 환경변수 로드 확인
  // ============================================================================
  console.log("1️⃣ 환경변수 로드 확인");
  console.log("─".repeat(50));

  const requiredEnvVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SHOPIFY_STORE_URL: process.env.SHOPIFY_STORE_URL,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
  };

  let allEnvLoaded = true;

  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      console.error(`❌ ${key}: 누락됨`);
      allEnvLoaded = false;
    } else {
      // 민감한 키는 일부만 표시
      const displayValue =
        key.includes("KEY") || key.includes("TOKEN")
          ? `${value.substring(0, 10)}...`
          : value;
      console.log(`✅ ${key}: ${displayValue}`);
    }
  }

  if (!allEnvLoaded) {
    console.error("\n❌ 일부 환경변수가 누락되었습니다!");
    console.error("💡 .env 파일을 확인해 주세요.");
    process.exit(1);
  }

  console.log("\n✨ 모든 환경변수가 정상적으로 로드되었습니다!\n");

  // ============================================================================
  // 2단계: Supabase 클라이언트 생성
  // ============================================================================
  console.log("2️⃣ Supabase 클라이언트 생성");
  console.log("─".repeat(50));

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.error("❌ Supabase 환경변수가 설정되지 않았습니다.");
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log("✅ Supabase 클라이언트 생성 완료\n");

  // ============================================================================
  // 3단계: Supabase 연결 테스트 (간단한 쿼리)
  // ============================================================================
  console.log("3️⃣ Supabase 연결 테스트");
  console.log("─".repeat(50));

  try {
    // 간단한 SELECT 쿼리로 연결 확인
    const { data, error } = await supabase.from("products").select("count");

    if (error) {
      // 테이블이 아직 없으면 에러가 날 수 있음 (정상)
      if (
        error.message.includes("does not exist") ||
        error.message.includes("Could not find the table")
      ) {
        console.log("⚠️  products 테이블이 아직 생성되지 않았습니다.");
        console.log(
          "💡 이것은 정상입니다! 곧 마이그레이션을 실행할 예정입니다.\n"
        );
        console.log("✅ Supabase 연결은 정상 작동 중입니다!\n");
      } else {
        console.error(`❌ Supabase 쿼리 실패: ${error.message}`);
        process.exit(1);
      }
    } else {
      console.log("✅ Supabase 연결 성공!");
      console.log(`📊 products 테이블 레코드 수: ${data?.length || 0}\n`);
    }
  } catch (err) {
    console.error("❌ Supabase 연결 중 예외 발생:", err);
    process.exit(1);
  }

  // ============================================================================
  // 4단계: Service Role Key 확인
  // ============================================================================
  console.log("4️⃣ Service Role Key 확인");
  console.log("─".repeat(50));

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
    process.exit(1);
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Service Role로 연결 확인
    const { error } = await supabaseAdmin.from("products").select("count");

    if (
      error &&
      !error.message.includes("does not exist") &&
      !error.message.includes("Could not find the table")
    ) {
      console.error(`❌ Service Role Key 연결 실패: ${error.message}`);
      process.exit(1);
    }

    console.log("✅ Service Role Key 정상 작동\n");
  } catch (err) {
    console.error("❌ Service Role Key 테스트 중 예외 발생:", err);
    process.exit(1);
  }

  // ============================================================================
  // 최종 결과
  // ============================================================================
  console.log("─".repeat(50));
  console.log("🎉 모든 테스트 통과!");
  console.log("\n✅ 환경변수 로드: 정상");
  console.log("✅ Supabase 연결: 정상");
  console.log("✅ Service Role Key: 정상");
  console.log("\n💡 이제 DB 마이그레이션을 진행할 준비가 되었습니다!");
  console.groupEnd();

  process.exit(0);
}

// 스크립트 실행
if (require.main === module) {
  testEnvironmentAndConnection();
}

export { testEnvironmentAndConnection };

