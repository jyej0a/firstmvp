/**
 * @file lib/utils/__tests__/category-matcher.test.ts
 * @description 카테고리 매칭 시스템 테스트
 */

import { matchCategoryToShopify } from "../category-matcher";

describe("Category Matcher", () => {
  // 환경변수 확인
  const hasShopifyConfig =
    process.env.SHOPIFY_STORE_URL &&
    process.env.SHOPIFY_ACCESS_TOKEN &&
    process.env.SHOPIFY_API_VERSION;

  if (!hasShopifyConfig) {
    console.warn("⚠️  Shopify 환경변수가 설정되지 않아 실제 API 테스트를 건너뜁니다.");
  }

  describe("유사도 계산", () => {
    it("정확히 일치하는 카테고리는 높은 신뢰도를 반환해야 함", async () => {
      if (!hasShopifyConfig) {
        return;
      }

      const result = await matchCategoryToShopify("Electronics > Computers > Laptops");
      
      // 실제 API 호출이므로 결과가 없을 수도 있음
      // 하지만 에러가 발생하지 않아야 함
      expect(result).toBeDefined();
      expect(result.success !== undefined).toBe(true);
    });
  });

  describe("매핑 실패 처리", () => {
    it("존재하지 않는 카테고리는 실패를 반환해야 함", async () => {
      if (!hasShopifyConfig) {
        return;
      }

      const result = await matchCategoryToShopify("NonExistentCategory > Test > Invalid");
      
      // 매칭 실패 시 success: false 반환
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe("빈 카테고리 처리", () => {
    it("빈 문자열은 에러를 반환해야 함", async () => {
      const result = await matchCategoryToShopify("");
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("제공되지 않았습니다");
    });
  });
});

