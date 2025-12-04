/**
 * @file lib/utils/test-rate-limiter.ts
 * @description Rate Limiter 테스트 스크립트
 */

import {
  checkRateLimit,
  resetRateLimits,
  getRateLimitStats,
} from "./rate-limiter";

async function testRateLimiter() {
  console.log("=".repeat(70));
  console.log("🧪 Rate Limiter 테스트");
  console.log("=".repeat(70));
  console.log();

  const testIp = "192.168.1.100";

  // 초기화
  resetRateLimits();
  console.log("🔄 Rate Limiter 초기화 완료\n");

  // Test 1: 첫 요청 (통과)
  console.group("📝 Test 1: 첫 요청");
  const result1 = checkRateLimit(testIp);
  console.log(`결과: ${result1.allowed ? "✅ 허용" : "❌ 거부"}`);
  console.groupEnd();
  console.log();

  // Test 2: 즉시 재요청 (개발 환경에서는 통과, 프로덕션에서는 거부)
  console.group("📝 Test 2: 즉시 재요청 (간격 0초)");
  const result2 = checkRateLimit(testIp);
  console.log(`결과: ${result2.allowed ? "✅ 허용" : "❌ 거부"}`);
  if (!result2.allowed) {
    console.log(`사유: ${result2.reason}`);
    console.log(`대기 시간: ${result2.retryAfter}초`);
  }
  console.groupEnd();
  console.log();

  // Test 3: 통계 확인
  console.group("📊 Test 3: 통계 확인");
  const stats = getRateLimitStats();
  console.log(`총 기록: ${stats.totalRecords}개`);
  stats.records.forEach((record) => {
    console.log(`  IP: ${record.ip}`);
    console.log(`  마지막 요청: ${new Date(record.info.lastRequestTime).toLocaleString()}`);
    console.log(`  요청 횟수: ${record.info.requestCount}`);
  });
  console.groupEnd();
  console.log();

  console.log("=".repeat(70));
  console.log("✨ 테스트 완료!");
  console.log("=".repeat(70));
  console.log();
  console.log("💡 현재 환경:", process.env.NODE_ENV || "development");
  console.log(
    "   - development: Rate Limiting 비활성화 (제한 없음)"
  );
  console.log(
    "   - production: Rate Limiting 활성화 (엄격한 제한)"
  );
}

if (require.main === module) {
  testRateLimiter();
}

export { testRateLimiter };

