# 카테고리 매칭 시스템 테스트 가이드

## 테스트 전 준비사항

### 1. 마이그레이션 실행

먼저 `category_mapping` 테이블을 생성해야 합니다:

```bash
# Supabase CLI를 사용하는 경우
supabase migration up

# 또는 Supabase Dashboard에서 직접 실행
# supabase/migrations/20250106000000_create_category_mapping_table.sql 파일 내용을 복사하여 실행
```

### 2. 환경변수 확인

다음 환경변수가 설정되어 있어야 합니다:

```env
SHOPIFY_STORE_URL=https://your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_API_VERSION=2024-01
```

## 테스트 방법

### 방법 1: API 엔드포인트 테스트 (권장)

개발 서버를 실행한 후 브라우저나 curl로 테스트:

```bash
# 개발 서버 실행
pnpm dev

# 다른 터미널에서 테스트
curl "http://localhost:3000/api/test/category-match?category=Electronics%20%3E%20Computers%20%3E%20Laptops"
```

또는 브라우저에서:
```
http://localhost:3000/api/test/category-match?category=Electronics%20%3E%20Computers%20%3E%20Laptops
```

**예상 응답:**
```json
{
  "input": "Electronics > Computers > Laptops",
  "result": {
    "success": true,
    "shopifyCategoryId": "gid://shopify/TaxonomyCategory/...",
    "shopifyCategoryName": "Electronics > Computers > Laptops",
    "confidence": 0.95,
    "matchMethod": "exact"
  },
  "timestamp": "2025-01-06T..."
}
```

### 방법 2: 실제 스크래핑 플로우 테스트

1. 아마존 상품 스크래핑 실행
2. 상세 페이지에서 카테고리 수집 확인
3. 쇼피파이 등록 시 카테고리 매칭 확인

**확인 사항:**
- 콘솔 로그에서 `📂 상세 페이지 카테고리 수집` 메시지 확인
- `✅ 카테고리 추출 성공` 메시지 확인
- `✅ 카테고리 매칭 성공` 메시지 확인
- DB의 `products_v2` 테이블에서 `category` 필드 확인
- DB의 `category_mapping` 테이블에서 매핑 데이터 확인

### 방법 3: 단위 테스트 실행

```bash
# Jest 테스트 실행 (설정되어 있는 경우)
pnpm test lib/utils/__tests__/category-matcher.test.ts
```

## 테스트 케이스

### 성공 케이스

1. **정확한 매칭**
   - 입력: `Electronics > Computers > Laptops`
   - 예상: 쇼피파이에서 동일한 카테고리 찾기

2. **부분 매칭**
   - 입력: `Electronics > Computers`
   - 예상: 유사한 카테고리 찾기 (신뢰도 0.7-0.9)

3. **유사도 매칭**
   - 입력: `Electronics > Computer Accessories`
   - 예상: 유사한 카테고리 찾기 (신뢰도 0.6-0.8)

### 실패 케이스

1. **존재하지 않는 카테고리**
   - 입력: `NonExistentCategory > Test`
   - 예상: `success: false`, 에러 메시지 반환

2. **빈 카테고리**
   - 입력: `""`
   - 예상: `success: false`, "제공되지 않았습니다" 메시지

3. **신뢰도 부족**
   - 입력: `RandomCategory123`
   - 예상: `success: false`, "신뢰도가 너무 낮습니다" 메시지

## 데이터베이스 확인

### category_mapping 테이블 확인

```sql
-- 모든 매핑 조회
SELECT * FROM category_mapping ORDER BY created_at DESC;

-- 특정 아마존 카테고리 매핑 확인
SELECT * FROM category_mapping 
WHERE amazon_category_name = 'Electronics > Computers > Laptops';

-- 매칭 신뢰도가 높은 순으로 조회
SELECT * FROM category_mapping 
WHERE is_active = true 
ORDER BY match_confidence DESC;
```

### products_v2 테이블 확인

```sql
-- 카테고리가 수집된 상품 확인
SELECT id, title, category, created_at 
FROM products_v2 
WHERE category != 'General' 
ORDER BY created_at DESC;
```

## 문제 해결

### 문제 1: Shopify API 오류

**증상:** `❌ Shopify GraphQL 오류` 메시지

**해결:**
- 환경변수 확인 (`SHOPIFY_STORE_URL`, `SHOPIFY_ACCESS_TOKEN`)
- Shopify API 버전 확인 (`SHOPIFY_API_VERSION`)
- Access Token 권한 확인 (Admin API 접근 권한 필요)

### 문제 2: 매핑 테이블 조회 실패

**증상:** `❌ 매핑 테이블 조회 실패` 메시지

**해결:**
- 마이그레이션 실행 확인
- Supabase 연결 확인
- `category_mapping` 테이블 존재 확인

### 문제 3: 카테고리 추출 실패

**증상:** `⚠️ 카테고리 추출 실패` 메시지

**해결:**
- 아마존 상품 상세 페이지 구조 변경 가능성
- Breadcrumb selector 확인 필요
- 수동으로 카테고리 입력 가능 (DB 직접 수정)

## 성능 모니터링

### 매핑 성공률 추적

```sql
-- 매핑 성공률 계산
SELECT 
  COUNT(*) as total_mappings,
  COUNT(CASE WHEN match_confidence >= 0.8 THEN 1 END) as high_confidence,
  COUNT(CASE WHEN match_confidence >= 0.6 AND match_confidence < 0.8 THEN 1 END) as medium_confidence,
  COUNT(CASE WHEN match_confidence < 0.6 THEN 1 END) as low_confidence
FROM category_mapping
WHERE is_active = true;
```

### 자주 사용되는 카테고리 확인

```sql
-- 가장 많이 매핑된 카테고리
SELECT 
  amazon_category_name,
  COUNT(*) as usage_count,
  AVG(match_confidence) as avg_confidence
FROM category_mapping
WHERE is_active = true
GROUP BY amazon_category_name
ORDER BY usage_count DESC
LIMIT 10;
```

