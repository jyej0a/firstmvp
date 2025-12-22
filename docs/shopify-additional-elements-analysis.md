# Shopify 상품 등록 시 추가 수집 가능 요소 분석

**작성일:** 2025-01-03  
**분석 기준:** Shopify 상품 편집 화면 + 현재 코드 분석

## 📊 현재 Shopify에 전달되는 필드

| Shopify 필드 | 현재 값 | 데이터 소스 | 상태 |
|-------------|---------|------------|------|
| `title` | 상품명 | 아마존 수집 ✅ | ✅ 정상 |
| `body_html` | 상품 설명 | 아마존 수집 (계획됨) | 🔄 예정 |
| `vendor` | "Trend-Hybrid" | 고정값 | ⚠️ 개선 가능 |
| `product_type` | "General" | 고정값 | 🔄 카테고리로 변경 예정 |
| `status` | "draft" | 고정값 | ✅ 정상 |
| `images` | 이미지 배열 | 아마존 수집 ✅ | ✅ 정상 |
| `variants` | 기본 variant만 | ASIN 기반 | 🔄 옵션 정보 추가 예정 |
| `tags` | 자동 생성 | `amazon,{type},asin:{asin}` | ✅ 정상 |

## 🎯 추가 수집 가능한 요소 (Shopify 반영 가능)

### 1. 브랜드명 (Brand/Vendor) ⭐ **추천**

**Shopify 필드:** `vendor`  
**현재 상태:** "Trend-Hybrid"로 고정  
**추출 가능 위치:**
- 상세 페이지: `#bylineInfo`, `.po-brand`, `#brand` 등
- 검색 결과 페이지: `.a-size-base` (브랜드 텍스트)

**Shopify 반영:**
- `vendor` 필드에 실제 브랜드명 전달
- 브랜드 필터링 및 검색에 유용

**우선순위:** 높음 (현재 고정값이므로 개선 가치 높음)

---

### 2. 상품 번호/모델 번호 (Model Number/Part Number)

**Shopify 필드:** `variants[].sku` 또는 메타 필드  
**현재 상태:** ASIN을 SKU로 사용 중  
**추출 가능 위치:**
- 상세 페이지: "Item model number", "Part Number" 등

**Shopify 반영:**
- 메타 필드로 저장 가능
- 재고 관리 및 주문 처리에 유용

**우선순위:** 중간 (ASIN이 이미 SKU로 사용 중)

---

### 3. 무게 (Weight) ⭐ **추천**

**Shopify 필드:** `variants[].weight`, `variants[].weight_unit`  
**현재 상태:** 미설정  
**추출 가능 위치:**
- 상세 페이지: "Product Dimensions", "Item Weight" 섹션
- Shipping 정보 섹션

**Shopify 반영:**
- 배송비 계산에 사용 가능
- 국제 배송 시 중요

**우선순위:** 높음 (배송비 계산에 유용)

---

### 4. 상품 크기/치수 (Dimensions)

**Shopify 필드:** `variants[].metafields` 또는 메타 필드  
**현재 상태:** 미설정  
**추출 가능 위치:**
- 상세 페이지: "Product Dimensions" 섹션
- 예: "10 x 8 x 2 inches"

**Shopify 반영:**
- 메타 필드로 저장 가능
- 배송비 계산 및 포장에 유용

**우선순위:** 중간

---

### 5. 배송 정보 (Shipping Information)

**Shopify 필드:** 메타 필드 또는 별도 관리  
**현재 상태:** 미설정  
**추출 가능 위치:**
- 상세 페이지: "Shipping" 섹션
- "FREE Shipping", "Prime" 등

**Shopify 반영:**
- 메타 필드로 저장 가능
- 배송 정책 설정에 참고

**우선순위:** 낮음 (드롭쉬핑 특성상 중요도 낮음)

---

### 6. 재고 상태 (Availability)

**Shopify 필드:** `variants[].inventory_quantity` 또는 메타 필드  
**현재 상태:** 0으로 고정 (드롭쉬핑)  
**추출 가능 위치:**
- 상세 페이지: "In Stock", "Only X left" 등

**Shopify 반영:**
- 메타 필드로 저장 가능
- 재고 관리 참고용

**우선순위:** 낮음 (드롭쉬핑이므로 실시간 재고 불필요)

---

### 7. 판매자 정보 (Seller Information)

**Shopify 필드:** 메타 필드  
**현재 상태:** 미설정  
**추출 가능 위치:**
- 상세 페이지: "Ships from", "Sold by" 등

**Shopify 반영:**
- 메타 필드로 저장 가능
- 판매자 추적용

**우선순위:** 낮음

---

## 📋 추천 추가 수집 요소 (우선순위별)

### 높음 (Shopify 등록 시 즉시 활용 가능)

1. **브랜드명 (Brand)** ⭐⭐⭐
   - `vendor` 필드에 실제 브랜드명 전달
   - 브랜드 필터링 및 검색 개선
   - 추출 난이도: 낮음

2. **무게 (Weight)** ⭐⭐
   - 배송비 계산에 활용
   - 국제 배송 시 중요
   - 추출 난이도: 중간

### 중간 (향후 활용 가능)

3. **상품 번호/모델 번호**
   - 메타 필드로 저장
   - 재고 관리 참고용
   - 추출 난이도: 중간

4. **상품 크기/치수**
   - 메타 필드로 저장
   - 배송비 계산 참고용
   - 추출 난이도: 중간

### 낮음 (선택 사항)

5. 배송 정보
6. 재고 상태
7. 판매자 정보

---

## 🔄 현재 계획에 포함된 요소 (참고)

- ✅ **카테고리** → `product_type` (계획됨)
- ✅ **상세 설명** → `body_html` (계획됨)
- ✅ **옵션 정보** → `variants` (계획됨)
- ❌ **리뷰수, 평점** → Shopify 불필요 (DB/UI만)

---

## 💡 결론 및 제안

### 즉시 추가 권장 (Shopify 반영)

1. **브랜드명 (Brand)**
   - 현재 "Trend-Hybrid"로 고정되어 있으나, 실제 브랜드명 추출 가능
   - Shopify `vendor` 필드에 반영
   - 추출 난이도 낮음, 활용도 높음

2. **무게 (Weight)**
   - 배송비 계산에 활용 가능
   - Shopify `variants[].weight` 필드에 반영
   - 추출 난이도 중간, 향후 배송비 자동 계산에 유용

### 향후 고려 (v1.1 이후)

3. 상품 번호/모델 번호 (메타 필드)
4. 상품 크기/치수 (메타 필드)

---

**다음 단계:** 사용자 확인 후 추가 수집 요소 결정

