# 스크래핑 요소 항목 점검 보고서

**작성일:** 2025-01-03  
**작업 코드:** 2-11-1  
**상태:** ✅ 완료

## 📋 현재 추출되고 있는 요소

### 1. 검색 결과 페이지에서 추출되는 요소

| 요소명 | 필드명 | 데이터 타입 | 추출 위치 | 상태 |
|--------|--------|-------------|-----------|------|
| **ASIN** | `asin` | `string` | `data-asin` 속성 또는 `data-uuid` 속성 | ✅ 정상 수집 |
| **제목** | `title` | `string` | `h2 a span`, `h2 span` 등 여러 selector 시도 | ✅ 정상 수집 |
| **이미지** | `images` | `string[]` | 검색 결과 페이지의 여러 소스에서 수집 | ✅ 정상 수집 (다중 소스) |
| **가격** | `amazonPrice` | `number` | `.a-price .a-offscreen` 등 여러 selector 시도 | ✅ 정상 수집 |
| **URL** | `sourceUrl` | `string` | `h2 a` 또는 `a.s-link-style`의 `href` 속성 | ✅ 정상 수집 |

**이미지 수집 상세:**
- 메인 썸네일 이미지 (`img.s-image`)
  - `src` 속성
  - `data-src` 속성 (lazy loading)
  - `srcset` 속성 파싱
- 추가 이미지 (`img[data-image-index]`)
- 갤러리 썸네일 (`.s-image-carousel img`, `.a-carousel-card img`)

### 2. 상세 페이지에서 추출되는 요소

| 요소명 | 필드명 | 데이터 타입 | 추출 위치 | 상태 |
|--------|--------|-------------|-----------|------|
| **추가 이미지** | `images` (병합) | `string[]` | 상세 페이지 이미지 갤러리 | ✅ 정상 수집 |

**상세 페이지 이미지 수집 상세:**
- 메인 상품 이미지 (`#landingImage`, `#main-image`, `#imgBlkFront`, `.a-dynamic-image`)
- 이미지 갤러리 썸네일 (`#imageBlock_feature_div img`, `#altImages ul li img`)
- 상품 설명 섹션 이미지 (`#productDescription img`, `#feature-bullets img`)
- 고해상도 URL 변환 (썸네일 → 고해상도)

### 3. 타입 정의에 있으나 실제 수집되지 않는 요소

| 요소명 | 필드명 | 데이터 타입 | 타입 정의 위치 | 실제 수집 여부 |
|--------|--------|-------------|---------------|----------------|
| **상품 설명** | `description` | `string?` | `ScrapedProductRaw` | ❌ 미수집 |
| **옵션 정보** | `variants` | `string[]?` | `ScrapedProductRaw` | ❌ 미수집 |

## ❌ 현재 미수집 항목 (PRD 요구사항 대비)

### 1. 카테고리 (Category)
- **요구사항:** PRD.md에 명시되지 않았으나, 사용자 요청으로 추가 필요
- **현재 상태:** ❌ 미수집
- **추출 가능 위치:** 상세 페이지 (`#wayfinding-breadcrumbs_feature_div` 또는 `#nav-breadcrumb`)

### 2. 상세 설명 (Description)
- **요구사항:** PRD.md 데이터 항목에 포함 (`Description (HTML/Text)`)
- **현재 상태:** ❌ 타입에는 정의되어 있으나 실제 수집 로직 없음
- **추출 가능 위치:** 상세 페이지 (`#productDescription`, `#feature-bullets`)

### 3. 리뷰수 (Review Count)
- **요구사항:** PRD.md Phase 2.5 스크래핑 요소 추가에 명시
- **현재 상태:** ❌ 미수집
- **추출 가능 위치:** 
  - 검색 결과 페이지: `.a-size-base` (리뷰 텍스트)
  - 상세 페이지: `#acrCustomerReviewText` 또는 `#acrCustomerReviewLink`

### 4. 평점 (Rating)
- **요구사항:** PRD.md Phase 2.5 스크래핑 요소 추가에 명시
- **현재 상태:** ❌ 미수집
- **추출 가능 위치:**
  - 검색 결과 페이지: `.a-icon-alt` (별점 텍스트, 예: "4.5 out of 5 stars")
  - 상세 페이지: `#acrPopover` 또는 `.a-icon-alt`

### 5. 옵션 정보 (Variants)
- **요구사항:** PRD.md 데이터 항목에 포함 (`Variants (Array[Text])`)
- **현재 상태:** ❌ 타입에는 정의되어 있으나 실제 수집 로직 없음
- **추출 가능 위치:** 상세 페이지 (`#variation_color_name`, `#variation_size_name` 등)

## 📊 수집 위치 요약

### 검색 결과 페이지 (`extractProductsFromPage`)
- ✅ ASIN
- ✅ 제목
- ✅ 이미지 (썸네일)
- ✅ 가격
- ✅ URL
- ❌ 리뷰수 (추출 가능)
- ❌ 평점 (추출 가능)

### 상세 페이지 (`extractImagesFromDetailPage` + 추가 필요)
- ✅ 이미지 (고해상도 갤러리)
- ❌ 카테고리 (추출 가능)
- ❌ 상세 설명 (추출 가능)
- ❌ 리뷰수 (추출 가능)
- ❌ 평점 (추출 가능)
- ❌ 옵션 정보 (추출 가능)

## 🎯 다음 단계 (추가 수집 계획)

### 우선순위 높음 (Phase 2.5 필수)
1. **카테고리** - 사용자 요청 사항
2. **리뷰수** - PRD Phase 2.5 요구사항
3. **평점** - PRD Phase 2.5 요구사항
4. **상세 설명** - PRD 데이터 항목에 포함

### 우선순위 중간 (v1.1 고려)
5. **옵션 정보** - PRD 데이터 항목에 포함

### 이미지 수집 개선
- 현재 이미지 수집은 다중 소스에서 이루어지고 있으나, 중복 제거 및 고해상도 우선 수집 로직 개선 필요

## 📝 참고 사항

- 현재 `scrapeSingleProduct` 함수에서 상세 페이지 접속은 이미지 수집 목적으로만 사용됨
- 상세 페이지 접속 시 추가 요소(카테고리, description, 리뷰수, 평점)를 한 번에 수집하도록 확장 가능
- 검색 결과 페이지에서도 리뷰수와 평점 추출 가능 (상세 페이지 접속 전에 미리 수집 가능)

---

**다음 작업:** 2-11-2. DB 스키마 확장 (카테고리, 리뷰수, 평점 컬럼 추가)

