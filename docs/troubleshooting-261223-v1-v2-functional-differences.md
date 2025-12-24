# 트러블슈팅 - 261223: V1과 V2의 기능적 차이점 분석 보고서

**작성일**: 2025-12-23  
**목적**: V1과 V2 시스템의 기능적 차이점을 명확히 하고, 각 시스템의 구현 상태를 점검하여 테스트 가능 여부를 확인

---

## 📋 목차

1. [V1과 V2의 핵심 차이점](#v1과-v2의-핵심-차이점)
2. [구현 상태 점검](#구현-상태-점검)
3. [데이터베이스 구조](#데이터베이스-구조)
4. [API 엔드포인트 비교](#api-엔드포인트-비교)
5. [대시보드 UI 비교](#대시보드-ui-비교)
6. [테스트 체크리스트](#테스트-체크리스트)
7. [알려진 이슈 및 수정 필요 사항](#알려진-이슈-및-수정-필요-사항)

---

## V1과 V2의 핵심 차이점

### V1 (일괄 수집 모드) - 히스토리 보존용

| 항목 | V1 특징 |
|------|---------|
| **스크래핑 방식** | 30개 상품을 한 번에 일괄 수집 |
| **응답 방식** | 동기식 (수집 완료 후 결과 반환, HTTP 200) |
| **데이터 저장** | `products_v1` 테이블 |
| **Shopify 등록** | 수동 선택 후 일괄 등록 |
| **언어 설정** | 영어 강제 (`forceEnglish: true`) |
| **대시보드** | `/dashboard` - 상품 목록 및 선택 등록 UI |
| **API 엔드포인트** | `/api/scrape` |
| **사용 목적** | 히스토리 자료 보존 (더 이상 신규 개발 없음) |

### V2 (순차 처리 모드) - 신규 시스템

| 항목 | V2 특징 |
|------|---------|
| **스크래핑 방식** | 1분당 1개씩 순차 수집 (최대 1000개/일) |
| **응답 방식** | 비동기식 (Job 시작 후 즉시 응답, HTTP 202) |
| **데이터 저장** | `products_v2` 테이블 |
| **Shopify 등록** | 자동 등록 (수집 → 저장 → 등록 자동화) |
| **언어 설정** | 기본 설정 (영어 강제 없음) |
| **대시보드** | `/dashboard-v2` - 통계 그래프 및 Job 진행 상황 |
| **API 엔드포인트** | `/api/scrape-v2` |
| **Job 관리** | `scraping_jobs`, `scraping_job_items` 테이블 사용 |
| **사용 목적** | 새로운 시스템으로 운영 (지속적 개발) |

---

## 구현 상태 점검

### ✅ 정상 구현된 부분

#### 1. V1 API (`app/api/scrape/route.ts`)
- ✅ `products_v1` 테이블 사용
- ✅ 일괄 수집 로직 정상 구현
- ✅ 영어 강제 설정 적용 (`forceEnglish: true`)
- ✅ 금지어 필터링 적용
- ✅ 동기식 응답 (HTTP 200)

#### 2. V2 API (`app/api/scrape-v2/route.ts`)
- ✅ `products_v2` 테이블 사용 (sequential-scraper.ts에서)
- ✅ 비동기 Job 시작 정상 구현
- ✅ 즉시 응답 (HTTP 202)
- ✅ Job ID 반환

#### 3. V2 순차 스크래퍼 (`lib/scraper/sequential-scraper.ts`)
- ✅ `products_v2` 테이블 사용
- ✅ 자동 Shopify 등록 포함
- ✅ Job 상태 관리 (`scraping_jobs`, `scraping_job_items`)
- ✅ 진행 상황 실시간 업데이트
- ✅ 에러 처리 및 재시도 로직

#### 4. 데이터 저장 유틸리티 (`lib/utils/save-products.ts`)
- ✅ 테이블명 파라미터 지원 (`products_v1` / `products_v2`)
- ✅ V1과 V2 모두에서 사용 가능

---

## 데이터베이스 구조

### 테이블 구조

#### `products_v1` (V1 히스토리 보존용)
- 기존 `products` 테이블의 데이터를 마이그레이션
- V1 API에서만 사용
- 더 이상 신규 데이터 추가 없음 (히스토리 보존)

#### `products_v2` (V2 신규 시스템)
- 기존 `products` 테이블의 데이터를 복사 (초기 데이터)
- V2 API에서 사용
- 새로운 스크래핑 데이터 저장

#### `scraping_jobs` (V2 전용)
- 순차 처리 Job 관리
- 상태: `pending`, `running`, `paused`, `completed`, `failed`, `cancelled`

#### `scraping_job_items` (V2 전용)
- 각 Job의 상품별 상세 정보
- `product_id` → `products_v2.id` 외래키 참조
- 상태: `pending`, `scraping`, `saved`, `registered`, `failed`

---

## API 엔드포인트 비교

### V1 API

#### `POST /api/scrape`
- **기능**: 일괄 수집 (30개)
- **요청**:
  ```json
  {
    "searchInput": "키워드 또는 Amazon URL"
  }
  ```
- **응답** (HTTP 200):
  ```json
  {
    "success": true,
    "data": {
      "products": ScrapedProductRaw[],
      "stats": {
        "totalScraped": number,
        "filteredOut": number,
        "saved": number,
        "failed": number,
        "duration": number,
        "pagesScraped": number
      }
    }
  }
  ```
- **저장 테이블**: `products_v1`

### V2 API

#### `POST /api/scrape-v2`
- **기능**: 순차 처리 Job 시작
- **요청**:
  ```json
  {
    "searchInput": "키워드 또는 Amazon URL",
    "totalTarget": number (선택사항, 기본값: 1000, 최대: 1000)
  }
  ```
- **응답** (HTTP 202):
  ```json
  {
    "success": true,
    "data": {
      "jobId": "string",
      "message": "순차 처리 작업이 시작되었습니다."
    }
  }
  ```
- **저장 테이블**: `products_v2`

#### `GET /api/scrape-v2/[jobId]`
- **기능**: Job 진행 상황 조회
- **응답**:
  ```json
  {
    "success": true,
    "data": {
      "jobId": "string",
      "status": "running",
      "currentCount": 50,
      "totalTarget": 1000,
      "successCount": 48,
      "failedCount": 2,
      "estimatedTimeRemaining": 950,
      "progressPercentage": 5
    }
  }
  ```

---

## 대시보드 UI 비교

### V1 대시보드 (`/dashboard`)

**주요 기능**:
- 키워드/URL 입력 및 일괄 수집 시작
- 수집된 상품 목록 표시
- 체크박스로 상품 선택
- 선택한 상품 일괄 Shopify 등록
- 마진율 변경 기능

**UI 특징**:
- 상품 목록 중심
- 수동 선택 및 등록
- 실시간 결과 표시 (동기식)

### V2 대시보드 (`/dashboard-v2`)

**주요 기능**:
- 통계 그래프 (일별 수집 현황, 상태별 분포)
- 최근 Job 현황
- Job 진행 상황 실시간 표시

**서브 페이지**:
- `/dashboard-v2/scrape`: 스크래핑 시작 페이지
- `/dashboard-v2/products`: 상품 목록 관리
- `/dashboard-v2/history`: Job 히스토리

**UI 특징**:
- 통계 및 시각화 중심
- 자동화된 워크플로우
- 비동기 Job 진행 상황 표시

---

## 테스트 체크리스트

### V1 테스트 항목

#### 기본 기능
- [ ] `/dashboard` 페이지 접속 가능
- [ ] 키워드 입력 필드 정상 작동
- [ ] "수집 시작" 버튼 클릭 시 API 호출

#### 스크래핑 기능
- [ ] 키워드 입력 후 스크래핑 시작
- [ ] 30개 상품 일괄 수집 확인
- [ ] 수집 완료까지 대기 (동기식)
- [ ] 수집 결과 메시지 표시

#### 데이터 저장
- [ ] `products_v1` 테이블에 데이터 저장 확인
- [ ] Supabase에서 직접 데이터 확인

#### 상품 목록 조회
- [ ] 페이지 로드 시 상품 목록 자동 조회
- [ ] V1 데이터만 표시되는지 확인
- [ ] 상품 정보 정상 표시

#### Shopify 등록
- [ ] 체크박스로 상품 선택
- [ ] "선택 등록" 버튼 클릭
- [ ] Shopify 일괄 등록 성공 확인
- [ ] 상품 상태가 `uploaded`로 변경되는지 확인

#### 마진율 변경
- [ ] 마진율 입력 필드 정상 작동
- [ ] 마진율 변경 시 판매가 자동 재계산
- [ ] DB에 변경사항 저장 확인

### V2 테스트 항목

#### 기본 기능
- [ ] `/dashboard-v2` 페이지 접속 가능
- [ ] 통계 그래프 정상 표시
- [ ] 최근 Job 목록 표시

#### 스크래핑 기능
- [ ] `/dashboard-v2/scrape` 페이지 접속
- [ ] 키워드 입력 후 스크래핑 시작
- [ ] Job ID 즉시 반환 확인 (HTTP 202)
- [ ] 진행 상황 실시간 조회

#### 데이터 저장
- [ ] `products_v2` 테이블에 데이터 저장 확인
- [ ] `scraping_jobs` 테이블에 Job 생성 확인
- [ ] `scraping_job_items` 테이블에 아이템 생성 확인

#### 자동 Shopify 등록
- [ ] 수집 → 저장 → 등록 자동화 확인
- [ ] 상품 상태가 자동으로 `uploaded`로 변경되는지 확인
- [ ] Shopify에 실제 상품 등록 확인

#### 진행 상황 모니터링
- [ ] Job 진행 상황 실시간 업데이트
- [ ] 진행률 퍼센트 표시
- [ ] 예상 완료 시간 표시
- [ ] 성공/실패 개수 표시

---

## 알려진 이슈 및 수정 필요 사항

### ⚠️ 수정 필요 부분

#### 1. V1 대시보드 상품 조회 문제

**문제점**:
- V1 대시보드 (`app/dashboard/page.tsx`)가 `/api/products`를 호출
- 현재 `/api/products`는 항상 `products_v2`를 조회
- V1 대시보드에서 V1 데이터를 조회하지 못함

**영향**:
- V1 대시보드에서 상품 목록이 비어 보일 수 있음
- V1으로 수집한 데이터가 표시되지 않음

**해결 방안**:
1. **옵션 1 (권장)**: 쿼리 파라미터로 구분
   - `/api/products?version=v1` → `products_v1` 조회
   - `/api/products?version=v2` → `products_v2` 조회 (기본값)
   - V1 대시보드에서 `?version=v1` 추가

2. **옵션 2**: 별도 엔드포인트
   - `/api/products-v1` → `products_v1` 조회
   - `/api/products` → `products_v2` 조회 (기존 유지)

3. **옵션 3**: V1은 히스토리 전용
   - V1 대시보드는 읽기 전용으로 제한
   - V1 API는 스크래핑만 가능, 조회는 V2로 리다이렉트

**파일 위치**:
- `app/dashboard/page.tsx` (57번 줄: `fetchProducts` 함수)
- `app/api/products/route.ts` (95-104번 줄: 쿼리 빌더)

#### 2. 상품 상세/수정 API 문제

**문제점**:
- `app/api/products/[id]/route.ts`가 항상 `products_v2` 조회
- V1 상품의 상세 조회/수정 불가

**해결 방안**:
- 쿼리 파라미터 또는 헤더로 버전 구분
- 또는 V1은 읽기 전용으로 제한

**파일 위치**:
- `app/api/products/[id]/route.ts`

#### 3. 통계 API 문제

**문제점**:
- `app/api/dashboard/stats/route.ts`가 항상 `products_v2` 조회
- V1 통계를 볼 수 없음

**해결 방안**:
- V2 전용으로 명시하거나
- 쿼리 파라미터로 V1/V2 구분

**파일 위치**:
- `app/api/dashboard/stats/route.ts`

---

## 권장 사항

### 1. V1은 히스토리 보존용으로 제한
- 새로운 기능은 V2에만 추가
- V1 대시보드는 기존 데이터 조회만 가능하도록 제한 고려
- V1 API는 스크래핑 기능만 유지

### 2. API 버전 구분 명확화
- 쿼리 파라미터 또는 헤더로 버전 구분
- API 문서에 버전 명시
- 혼동 방지를 위한 명확한 네이밍

### 3. 테스트 우선순위
1. **V2 우선**: 새로운 시스템이므로 V2 테스트 우선
2. **V1 기본 기능**: 히스토리 보존용이므로 기본 기능만 확인
3. **데이터 분리**: V1/V2 데이터가 올바른 테이블에 저장되는지 확인

---

## 결론

### 현재 상태
- ✅ V1과 V2의 데이터베이스 이원화 완료
- ✅ V1 API는 `products_v1` 사용 정상
- ✅ V2 API는 `products_v2` 사용 정상
- ⚠️ V1 대시보드 상품 조회 기능 수정 필요

### 테스트 가능 여부
- **V1**: 기본 스크래핑 기능은 테스트 가능하나, 상품 목록 조회는 수정 후 테스트 권장
- **V2**: 모든 기능 테스트 가능

### 다음 단계
1. V1 대시보드 상품 조회 API 수정
2. V1 기본 기능 테스트
3. V2 전체 기능 테스트
4. 데이터 분리 확인 (V1/V2 데이터가 올바른 테이블에 저장되는지)

---

**작성자**: AI Assistant  
**검토 필요**: V1 대시보드 상품 조회 API 수정 사항 확인

