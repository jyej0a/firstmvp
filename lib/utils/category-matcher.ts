/**
 * @file lib/utils/category-matcher.ts
 * @description 아마존 카테고리와 쇼피파이 카테고리 매칭 유틸리티
 *
 * 이 파일은 아마존에서 수집한 카테고리를 쇼피파이 Standard Product Taxonomy와
 * 매칭하는 기능을 제공합니다.
 *
 * 주요 기능:
 * 1. 쇼피파이 GraphQL API로 카테고리 검색
 * 2. 카테고리 이름 기반 유사도 매칭
 * 3. 매핑 테이블 조회 및 저장
 * 4. 자동 매칭 실패 시 처리
 *
 * @dependencies
 * - Shopify GraphQL Admin API
 * - Supabase (매핑 테이블 저장)
 */

import { createClerkSupabaseClient } from "@/lib/supabase/server";

/**
 * 쇼피파이 카테고리 검색 결과
 */
export interface ShopifyCategoryMatch {
  /** 쇼피파이 카테고리 ID */
  id: string;
  /** 쇼피파이 카테고리 이름 (전체 경로) */
  name: string;
  /** 매칭 신뢰도 (0.0-1.0) */
  confidence: number;
  /** 카테고리 계층 깊이 (옵션) */
  level?: number;
  /** Leaf 카테고리 여부 (최하위 카테고리) */
  isLeaf?: boolean;
}

/**
 * 카테고리 매칭 결과
 */
export interface CategoryMatchResult {
  /** 매칭 성공 여부 */
  success: boolean;
  /** 쇼피파이 카테고리 ID (성공 시) */
  shopifyCategoryId?: string;
  /** 쇼피파이 카테고리 이름 (성공 시) */
  shopifyCategoryName?: string;
  /** 매칭 신뢰도 (0.0-1.0) */
  confidence?: number;
  /** 매칭 방법 */
  matchMethod?: "exact" | "partial" | "similarity" | "mapping_table";
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 문자열 유사도 계산 (Levenshtein distance 기반)
 * 
 * @param str1 - 첫 번째 문자열
 * @param str2 - 두 번째 문자열
 * @returns 유사도 (0.0-1.0, 1.0이 완벽한 일치)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // 정확히 일치하면 1.0 반환
  if (s1 === s2) {
    return 1.0;
  }

  // Levenshtein distance 계산
  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
  if (len2 === 0) return 0.0;

  const matrix: number[][] = [];

  // 초기화
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // 거리 계산
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // 삭제
        matrix[i][j - 1] + 1,      // 삽입
        matrix[i - 1][j - 1] + cost // 치환
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  
  // 유사도 = 1 - (거리 / 최대 길이)
  return 1.0 - distance / maxLen;
}

/**
 * 카테고리 경로를 부분적으로 비교
 * 
 * @param amazonPath - 아마존 카테고리 경로
 * @param shopifyPath - 쇼피파이 카테고리 경로
 * @returns 부분 매칭 여부 및 신뢰도
 */
function checkPartialMatch(
  amazonPath: string,
  shopifyPath: string
): { matched: boolean; confidence: number } {
  const amazonParts = amazonPath.split(" > ").map((p) => p.toLowerCase().trim());
  const shopifyParts = shopifyPath.split(" > ").map((p) => p.toLowerCase().trim());

  // 마지막 부분이 일치하는지 확인 (가장 구체적인 카테고리)
  if (amazonParts.length > 0 && shopifyParts.length > 0) {
    const amazonLast = amazonParts[amazonParts.length - 1];
    const shopifyLast = shopifyParts[shopifyParts.length - 1];
    
    if (amazonLast === shopifyLast) {
      // 부모 카테고리도 일치하는지 확인
      let matchingParents = 0;
      const minLength = Math.min(amazonParts.length - 1, shopifyParts.length - 1);
      
      for (let i = 0; i < minLength; i++) {
        if (amazonParts[i] === shopifyParts[i]) {
          matchingParents++;
        }
      }
      
      // 부모 카테고리 일치 비율 계산
      const parentConfidence = minLength > 0 ? matchingParents / minLength : 0.5;
      const totalConfidence = 0.7 + parentConfidence * 0.3; // 최소 0.7, 최대 1.0
      
      return { matched: true, confidence: totalConfidence };
    }
  }

  return { matched: false, confidence: 0.0 };
}

/**
 * Shopify Taxonomy API로 카테고리 검색
 * 
 * @param searchQuery - 검색 쿼리 (카테고리 키워드)
 * @returns 검색 결과 배열
 */
async function searchShopifyTaxonomy(
  searchQuery: string
): Promise<ShopifyCategoryMatch[]> {
  let storeUrl = process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-07";

  if (!storeUrl || !accessToken) {
    console.error("❌ Shopify 환경변수가 설정되지 않았습니다.");
    return [];
  }

  // URL 정리 (https:// 제거, 필요시 나중에 추가)
  storeUrl = storeUrl.replace(/^https?:\/\//, "");

  const graphqlEndpoint = `https://${storeUrl}/admin/api/${apiVersion}/graphql.json`;

  const query = `
    query SearchTaxonomy($search: String!) {
      taxonomy {
        categories(first: 20, search: $search) {
          edges {
            node {
              id
              fullName
              name
              level
              isLeaf
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query,
        variables: { search: searchQuery },
      }),
    });

    if (!response.ok) {
      console.error(`❌ Shopify Taxonomy API 오류: ${response.status}`);
      return [];
    }

    const result = await response.json();

    if (result.errors) {
      console.error("❌ GraphQL 에러:", result.errors);
      return [];
    }

    const categories = result.data?.taxonomy?.categories?.edges || [];

    return categories.map((edge: any) => ({
      id: edge.node.id,
      name: edge.node.fullName,
      confidence: 0.5, // 초기값, 나중에 계산
      level: edge.node.level,
      isLeaf: edge.node.isLeaf,
    }));
  } catch (error) {
    console.error("❌ Shopify Taxonomy 검색 실패:", error);
    return [];
  }
}

/**
 * 아마존 카테고리에서 검색 키워드 추출
 * 
 * @param amazonCategory - 아마존 카테고리 전체 경로
 * @returns 검색 키워드 배열
 */
function extractKeywords(amazonCategory: string): string[] {
  const parts = amazonCategory.split(" > ").map((p) => p.trim());
  
  // 마지막 2~3 단계의 카테고리 이름 사용
  const relevantParts = parts.slice(-3);
  
  // 불용어 제거
  const stopWords = ["and", "the", "for", "with", "accessories", "supplies", "equipment"];
  
  const keywords: string[] = [];
  
  for (const part of relevantParts) {
    // 공백 및 특수문자로 단어 분리
    const words = part.toLowerCase().split(/[\s&]+/);
    
    for (const word of words) {
      if (word.length > 2 && !stopWords.includes(word)) {
        keywords.push(word);
      }
    }
  }
  
  return [...new Set(keywords)]; // 중복 제거
}

/**
 * 쇼피파이 GraphQL API로 카테고리 검색 (레거시, 사용 안 함)
 * 
 * @param searchQuery - 검색 쿼리 (카테고리 이름)
 * @returns 검색 결과 배열
 * @deprecated searchShopifyTaxonomy 사용 권장
 */
async function searchShopifyCategories(
  searchQuery: string
): Promise<ShopifyCategoryMatch[]> {
  try {
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";

    if (!storeUrl || !accessToken) {
      console.warn("⚠️  Shopify 환경변수가 설정되지 않았습니다.");
      return [];
    }

    // GraphQL 쿼리
    const query = `
      query SearchCategories($search: String!) {
        taxonomy {
          categories(search: $search, first: 10) {
            edges {
              node {
                id
                fullName
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      `${storeUrl}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { search: searchQuery },
        }),
      }
    );

    if (!response.ok) {
      console.error(`❌ Shopify API 오류: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (data.errors) {
      console.error("❌ Shopify GraphQL 오류:", data.errors);
      return [];
    }

    const categories = data.data?.taxonomy?.categories?.edges || [];
    
    return categories.map((edge: any) => ({
      id: edge.node.id,
      name: edge.node.fullName,
      confidence: 0.0, // 초기값, 나중에 계산
    }));
  } catch (error) {
    console.error("❌ 쇼피파이 카테고리 검색 실패:", error);
    return [];
  }
}

/**
 * 매핑 테이블에서 카테고리 조회
 * 
 * @param amazonCategory - 아마존 카테고리 이름
 * @returns 매핑 정보 또는 null
 */
async function getMappingFromTable(
  amazonCategory: string
): Promise<{
  shopifyCategoryId: string;
  shopifyCategoryName: string;
  confidence: number;
} | null> {
  try {
    const supabase = createClerkSupabaseClient();

    const { data, error } = await supabase
      .from("category_mapping")
      .select("shopify_category_id, shopify_category_name, match_confidence")
      .eq("amazon_category_name", amazonCategory)
      .eq("is_active", true)
      .order("match_confidence", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      shopifyCategoryId: data.shopify_category_id,
      shopifyCategoryName: data.shopify_category_name || "",
      confidence: Number(data.match_confidence) || 0.0,
    };
  } catch (error) {
    console.error("❌ 매핑 테이블 조회 실패:", error);
    return null;
  }
}

/**
 * 매핑 테이블에 카테고리 저장
 * 
 * @param amazonCategory - 아마존 카테고리 이름
 * @param shopifyCategoryId - 쇼피파이 카테고리 ID
 * @param shopifyCategoryName - 쇼피파이 카테고리 이름
 * @param confidence - 매칭 신뢰도
 * @param matchMethod - 매칭 방법
 */
async function saveMappingToTable(
  amazonCategory: string,
  shopifyCategoryId: string,
  shopifyCategoryName: string,
  confidence: number,
  matchMethod: "auto" | "manual" | "api"
): Promise<void> {
  try {
    const supabase = createClerkSupabaseClient();

    // 기존 매핑이 있는지 확인
    const { data: existing } = await supabase
      .from("category_mapping")
      .select("id")
      .eq("amazon_category_name", amazonCategory)
      .single();

    if (existing) {
      // 업데이트
      await supabase
        .from("category_mapping")
        .update({
          shopify_category_id: shopifyCategoryId,
          shopify_category_name: shopifyCategoryName,
          match_confidence: confidence,
          match_method: matchMethod,
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // 새로 생성
      await supabase.from("category_mapping").insert({
        amazon_category_name: amazonCategory,
        shopify_category_id: shopifyCategoryId,
        shopify_category_name: shopifyCategoryName,
        match_confidence: confidence,
        match_method: matchMethod,
        is_active: true,
        last_verified_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("❌ 매핑 테이블 저장 실패:", error);
  }
}

/**
 * 아마존 카테고리를 쇼피파이 카테고리로 매칭
 * 
 * @param amazonCategory - 아마존 카테고리 이름 (예: "Electronics > Computers > Laptops")
 * @returns 매칭 결과
 */
export async function matchCategoryToShopify(
  amazonCategory: string
): Promise<CategoryMatchResult> {
  if (!amazonCategory || amazonCategory.trim() === "") {
    return {
      success: false,
      error: "아마존 카테고리가 제공되지 않았습니다.",
    };
  }

  const normalizedCategory = amazonCategory.trim();

  console.log(`🔍 카테고리 매칭 시작: ${normalizedCategory}`);

  // 1단계: 매핑 테이블에서 조회
  const mapping = await getMappingFromTable(normalizedCategory);
  if (mapping && mapping.confidence >= 0.7) {
    console.log(`✅ 매핑 테이블에서 발견: ${mapping.shopifyCategoryName} (신뢰도: ${mapping.confidence})`);
    return {
      success: true,
      shopifyCategoryId: mapping.shopifyCategoryId,
      shopifyCategoryName: mapping.shopifyCategoryName,
      confidence: mapping.confidence,
      matchMethod: "mapping_table",
    };
  }

  // 2단계: 아마존 카테고리에서 키워드 추출
  const keywords = extractKeywords(normalizedCategory);
  console.log(`🔑 추출된 키워드: ${keywords.join(", ")}`);

  // 3단계: Shopify Taxonomy 검색 (키워드 기반)
  const allResults: ShopifyCategoryMatch[] = [];
  
  for (const keyword of keywords) {
    const results = await searchShopifyTaxonomy(keyword);
    allResults.push(...results);
  }

  // 전체 카테고리 경로의 마지막 부분으로도 검색
  const lastPart = normalizedCategory.split(" > ").pop() || normalizedCategory;
  const fallbackResults = await searchShopifyTaxonomy(lastPart);
  allResults.push(...fallbackResults);

  if (allResults.length === 0) {
    return {
      success: false,
      error: "쇼피파이 Taxonomy에서 매칭되는 카테고리를 찾을 수 없습니다.",
    };
  }

  // 4단계: 중복 제거
  const uniqueResults = new Map<string, ShopifyCategoryMatch>();
  
  for (const result of allResults) {
    if (!uniqueResults.has(result.id)) {
      uniqueResults.set(result.id, result);
    }
  }

  const searchResults = Array.from(uniqueResults.values());
  console.log(`📊 총 ${searchResults.length}개의 카테고리 후보 발견`);

  // 5단계: 스마트 매칭 - 유사도 계산 및 최적 선택
  let bestMatch: ShopifyCategoryMatch | null = null;
  let bestConfidence = 0.0;

  for (const result of searchResults) {
    let confidence = 0.0;

    // 1) 정확한 일치 확인
    if (normalizedCategory.toLowerCase() === result.name.toLowerCase()) {
      confidence = 1.0;
    }
    // 2) 부분 매칭 확인
    else {
      const partial = checkPartialMatch(normalizedCategory, result.name);
      if (partial.matched) {
        confidence = partial.confidence;
      } else {
        // 3) 문자열 유사도 계산
        confidence = calculateSimilarity(normalizedCategory, result.name);
      }
    }

    // 4) Leaf 카테고리 보너스 (+0.1)
    if (result.isLeaf) {
      confidence = Math.min(1.0, confidence + 0.1);
    }

    // 5) 키워드 매칭 보너스
    const lowerResultName = result.name.toLowerCase();
    let keywordMatchCount = 0;
    for (const keyword of keywords) {
      if (lowerResultName.includes(keyword.toLowerCase())) {
        keywordMatchCount++;
      }
    }
    const keywordBonus = (keywordMatchCount / keywords.length) * 0.2;
    confidence = Math.min(1.0, confidence + keywordBonus);

    result.confidence = confidence;

    if (confidence > bestConfidence) {
      bestMatch = result;
      bestConfidence = confidence;
    }
  }

  console.log(`🎯 최고 신뢰도: ${bestConfidence.toFixed(2)} - ${bestMatch?.name || "없음"}`)

  // 4단계: 최소 신뢰도 임계값 확인 (0.6 이상)
  if (bestMatch && bestConfidence >= 0.6) {
    const matchMethod = bestConfidence >= 0.95 ? "exact" : bestConfidence >= 0.8 ? "partial" : "similarity";
    
    // 매핑 테이블에 저장 (자동 매칭)
    await saveMappingToTable(
      normalizedCategory,
      bestMatch.id,
      bestMatch.name,
      bestConfidence,
      "auto"
    );

    console.log(`✅ 자동 매칭 성공: ${bestMatch.name} (신뢰도: ${bestConfidence.toFixed(2)}, 방법: ${matchMethod})`);
    
    return {
      success: true,
      shopifyCategoryId: bestMatch.id,
      shopifyCategoryName: bestMatch.name,
      confidence: bestConfidence,
      matchMethod,
    };
  }

  // 매칭 실패
  return {
    success: false,
    error: `매칭 신뢰도가 너무 낮습니다 (${bestConfidence.toFixed(2)}). 최소 0.6 이상 필요합니다.`,
  };
}

