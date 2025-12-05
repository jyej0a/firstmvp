/**
 * @file lib/utils/filter-banned-keywords.ts
 * @description 금지어 필터링 유틸리티
 *
 * 이 파일은 Supabase banned_keywords 테이블에서 금지어 목록을 조회하고,
 * 스크래핑된 상품 중 금지어가 포함된 상품을 필터링하는 기능을 제공합니다.
 *
 * 주요 기능:
 * 1. Supabase에서 금지어 목록 조회
 * 2. 상품 제목에 금지어 포함 여부 확인 (대소문자 구분 없음)
 * 3. 필터링 통계 반환
 *
 * @see {@link /docs/PRD.md} - 금지어 필터링 요구사항
 * @see {@link /supabase/migrations/20241204000100_create_banned_keywords_table.sql} - 금지어 테이블 스키마
 */

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { ScrapedProductRaw } from "@/types";

/**
 * 필터링 결과 인터페이스
 */
export interface FilterResult {
  /** 필터링된 상품 목록 (금지어가 포함되지 않은 상품만) */
  filteredProducts: ScrapedProductRaw[];

  /** 필터링 통계 */
  stats: {
    /** 전체 상품 개수 (필터링 전) */
    total: number;

    /** 금지어로 제거된 상품 개수 */
    filteredOut: number;

    /** 통과한 상품 개수 (필터링 후) */
    passed: number;
  };
}

/**
 * Supabase에서 금지어 목록 조회
 *
 * @returns 금지어 배열 (모두 소문자로 변환됨)
 * @throws Supabase 조회 실패 시 에러
 */
export async function fetchBannedKeywords(): Promise<string[]> {
  console.group("🚫 금지어 목록 조회");

  try {
    const supabase = getServiceRoleClient();

    // banned_keywords 테이블에서 모든 금지어 조회
    const { data, error } = await supabase
      .from("banned_keywords")
      .select("keyword")
      .order("keyword", { ascending: true });

    if (error) {
      console.error("❌ 금지어 조회 실패:", error);
      throw new Error(`금지어 조회 실패: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.warn("⚠️  금지어 목록이 비어 있습니다.");
      console.groupEnd();
      return [];
    }

    // 금지어를 소문자로 변환하여 반환 (대소문자 구분 없는 매칭을 위해)
    const keywords = data.map((item) => item.keyword.toLowerCase());

    console.log(`✅ ${keywords.length}개 금지어 조회 완료`);
    console.log(`   금지어 목록: ${keywords.slice(0, 5).join(", ")}${keywords.length > 5 ? "..." : ""}`);
    console.groupEnd();

    return keywords;
  } catch (error) {
    console.error("❌ 금지어 조회 중 예상치 못한 오류:", error);
    console.groupEnd();
    throw error;
  }
}

/**
 * 상품 제목에 금지어가 포함되어 있는지 확인
 *
 * @param title - 상품 제목
 * @param bannedKeywords - 금지어 목록 (소문자로 변환된 상태)
 * @returns 포함된 금지어 (없으면 null)
 */
function checkBannedKeyword(
  title: string,
  bannedKeywords: string[]
): string | null {
  const lowerTitle = title.toLowerCase();

  // 제목에 금지어가 포함되어 있는지 확인 (부분 문자열 매칭)
  for (const keyword of bannedKeywords) {
    if (lowerTitle.includes(keyword)) {
      return keyword;
    }
  }

  return null;
}

/**
 * 금지어 필터링 메인 함수
 *
 * 상품 배열에서 금지어가 포함된 상품을 제거하고 통계를 반환합니다.
 *
 * @param products - 스크래핑된 상품 배열
 * @returns 필터링 결과 (필터링된 상품 + 통계)
 *
 * @example
 * const result = await filterByBannedKeywords(scrapedProducts);
 * console.log(`${result.stats.passed}개 통과, ${result.stats.filteredOut}개 제거`);
 */
export async function filterByBannedKeywords(
  products: ScrapedProductRaw[]
): Promise<FilterResult> {
  console.group("🔍 금지어 필터링 시작");

  const startTime = Date.now();
  const totalCount = products.length;

  console.log(`📊 필터링 대상: ${totalCount}개 상품`);

  // 1. 금지어 목록 조회
  const bannedKeywords = await fetchBannedKeywords();

  if (bannedKeywords.length === 0) {
    console.warn("⚠️  금지어가 없어 필터링을 건너뜁니다.");
    console.groupEnd();

    return {
      filteredProducts: products,
      stats: {
        total: totalCount,
        filteredOut: 0,
        passed: totalCount,
      },
    };
  }

  // 2. 상품 필터링
  const filteredProducts: ScrapedProductRaw[] = [];
  const removedProducts: Array<{
    title: string;
    keyword: string;
    asin: string;
  }> = [];

  for (const product of products) {
    const matchedKeyword = checkBannedKeyword(product.title, bannedKeywords);

    if (matchedKeyword) {
      // 금지어가 포함된 상품 제거
      removedProducts.push({
        title: product.title,
        keyword: matchedKeyword,
        asin: product.asin,
      });
    } else {
      // 금지어가 없는 상품 통과
      filteredProducts.push(product);
    }
  }

  // 3. 결과 통계
  const filteredOutCount = removedProducts.length;
  const passedCount = filteredProducts.length;
  const duration = Date.now() - startTime;

  // 4. 로그 출력
  console.log("\n" + "=".repeat(50));
  console.log("✅ 필터링 완료");
  console.log(`📊 전체: ${totalCount}개`);
  console.log(`❌ 제거: ${filteredOutCount}개`);
  console.log(`✅ 통과: ${passedCount}개`);
  console.log(`⏱️  소요 시간: ${duration}ms`);

  // 제거된 상품이 있으면 상세 로그 출력
  if (removedProducts.length > 0) {
    console.log("\n🚫 제거된 상품 목록:");
    removedProducts.forEach(({ title, keyword, asin }, index) => {
      console.log(
        `   ${index + 1}. [${keyword}] ${title.substring(0, 50)}... (${asin})`
      );
    });
  }

  console.log("=".repeat(50));
  console.groupEnd();

  return {
    filteredProducts,
    stats: {
      total: totalCount,
      filteredOut: filteredOutCount,
      passed: passedCount,
    },
  };
}

