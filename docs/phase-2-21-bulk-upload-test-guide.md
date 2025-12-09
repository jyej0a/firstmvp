# Phase 2.20-2.21 일괄 등록 API 테스트 가이드

**작성일**: 2024-12-09  
**구현 범위**: Shopify 일괄 등록 API 및 대시보드 통합

---

## 📋 구현 완료 항목

### ✅ Phase 2.20: 일괄 등록 API
- [x] `app/api/shopify/bulk-upload/route.ts` 생성
- [x] POST 핸들러 구현
- [x] Clerk 인증 확인
- [x] Supabase 상품 조회
- [x] 상품 검증 로직 (selling_price > 0, 필수 필드 확인)
- [x] 순차적 Shopify 등록
- [x] Status 업데이트 (uploaded/error)
- [x] 에러 메시지 저장
- [x] 최종 결과 반환

### ✅ Phase 2.21: 대시보드 통합
- [x] `handleBulkUpload` 함수 구현
- [x] 선택 등록 버튼 활성화
- [x] 로딩 상태 표시 ("등록 중...")
- [x] 성공/실패 메시지 표시
- [x] 리스트 새로고침 (status 업데이트 반영)

---

## 🧪 테스트 가이드

### 준비 사항

1. **개발 서버 실행**:
   ```bash
   pnpm dev
   ```

2. **로그인 상태 확인**:
   - Clerk 인증이 활성화되어 있는지 확인
   - 로그인하지 않은 경우 로그인 페이지로 리디렉션됨

3. **Shopify 환경 변수 확인**:
   - `.env` 파일에 다음 변수가 설정되어 있는지 확인:
     ```
     SHOPIFY_STORE_URL=https://talentmark.myshopify.com
     SHOPIFY_ACCESS_TOKEN=<your-token>
     SHOPIFY_API_VERSION=2025-01
     ```

---

## 📝 테스트 시나리오

### 1. 기본 플로우 테스트 (Happy Path)

**목표**: 상품을 수집하고 Shopify에 성공적으로 등록

1. **대시보드 접속**: `http://localhost:3000/dashboard`
2. **상품 수집**:
   - 입력창에 키워드 입력 (예: "neck device")
   - "수집 시작" 버튼 클릭
   - 수집 완료 메시지 확인
3. **상품 선택**:
   - 상품 리스트에서 체크박스로 2-3개 선택
   - "선택 등록 (3)" 버튼이 활성화되는지 확인
4. **일괄 등록**:
   - "선택 등록" 버튼 클릭
   - 로딩 메시지 표시 확인: "⏳ Shopify에 상품을 등록하고 있습니다..."
   - 성공 메시지 확인: "✅ 3개 상품이 Shopify에 등록되었습니다."
5. **결과 확인**:
   - 상품 리스트에서 status가 "uploaded"로 변경되었는지 확인
   - [Shopify Dashboard](https://talentmark.myshopify.com/admin/products) 접속하여 실제로 상품이 등록되었는지 확인

**예상 결과**:
- ✅ 선택한 3개 상품이 모두 Shopify에 등록됨
- ✅ 콘솔에 성공 로그 출력
- ✅ 상품 목록이 자동으로 새로고침됨

---

### 2. 인증 테스트

**목표**: 인증되지 않은 사용자는 API 접근 불가

1. **로그아웃**
2. **API 직접 호출** (선택 사항):
   ```bash
   curl -X POST http://localhost:3000/api/shopify/bulk-upload \
     -H "Content-Type: application/json" \
     -d '{"product_ids": ["test-id"]}'
   ```

**예상 결과**:
- ❌ 401 Unauthorized 에러
- 응답: `{"success": false, "error": "인증이 필요합니다."}`

---

### 3. 검증 테스트 (selling_price <= 0)

**목표**: 판매가가 0 이하인 상품은 등록 건너뛰기

1. **Supabase Dashboard** 접속
2. **테스트 상품 생성**:
   - `products` 테이블에 임시 상품 INSERT
   - `selling_price = 0` 또는 음수로 설정
3. **대시보드에서 해당 상품 선택**
4. **일괄 등록 시도**

**예상 결과**:
- ⚠️ 등록 실패
- status가 "error"로 변경
- error_message: "판매가가 0 이하입니다."

---

### 4. Rate Limit 대응 테스트

**목표**: 대량 등록 시 Rate Limit 에러 처리

1. **대시보드에서 10개 이상 상품 선택**
2. **일괄 등록 시도**
3. **콘솔 로그 확인**:
   - 각 상품이 순차적으로 처리되는지 확인
   - 재시도 로그 확인 (429 에러 발생 시)

**예상 결과**:
- ✅ 순차적으로 등록됨
- ✅ 429 에러 발생 시 자동 재시도 (최대 3회)
- ⏱️ 각 상품 사이에 0.5초 딜레이 적용

---

### 5. 에러 핸들링 테스트

**목표**: 일부 상품 실패 시에도 나머지는 계속 처리

1. **Supabase Dashboard**에서 테스트 상품 여러 개 생성:
   - 정상 상품 3개
   - 판매가 0인 상품 2개
2. **5개 모두 선택 후 일괄 등록**

**예상 결과**:
- ✅ 3개 성공, 2개 실패
- 성공 메시지: "3개 상품이 Shopify에 등록되었습니다. (2개 실패)"
- 실패한 상품의 status가 "error"로 변경

---

### 6. UI 상태 테스트

**목표**: 버튼 및 메시지 상태가 올바르게 표시되는지 확인

1. **아무 상품도 선택하지 않음**:
   - 버튼이 비활성화되어야 함
   - 버튼 텍스트: "선택 등록 (0)"

2. **3개 상품 선택**:
   - 버튼이 활성화되어야 함
   - 버튼 텍스트: "선택 등록 (3)"

3. **등록 진행 중**:
   - 버튼 비활성화
   - 버튼 텍스트: "등록 중..."
   - 로딩 메시지 표시

4. **등록 완료 후**:
   - 버튼 다시 활성화
   - 선택 초기화 (selectedIds = [])
   - 성공/실패 메시지 표시

---

## 🐛 디버깅 팁

### 콘솔 로그 확인

브라우저 개발자 도구 (F12) → Console 탭에서 다음 로그를 확인하세요:

```
🛒 [Dashboard] Shopify 일괄 등록
  선택된 상품 개수: 3개
  📡 일괄 등록 API 요청 전송 중...
  📦 API 응답: {...}
  ✅ 일괄 등록 완료!
     - 총 시도: 3개
     - 성공: 3개
     - 실패: 0개
  🔄 상품 목록 새로고침 중...
```

### API 응답 확인

Network 탭에서 `/api/shopify/bulk-upload` 요청을 찾아 응답을 확인하세요:

**성공 응답**:
```json
{
  "success": true,
  "data": {
    "total": 3,
    "success": 3,
    "failed": 0,
    "successIds": ["uuid1", "uuid2", "uuid3"],
    "failures": []
  },
  "message": "3개 상품이 성공적으로 등록되었습니다."
}
```

**실패 응답**:
```json
{
  "success": false,
  "error": "상품 ID 목록이 비어있거나 유효하지 않습니다."
}
```

---

## ✅ 완료 조건

모든 테스트를 통과하면 Phase 2.20-2.21이 완료된 것으로 간주합니다:

- [ ] 체크박스 선택 → 버튼 활성화
- [ ] 아무것도 선택하지 않음 → 버튼 비활성화
- [ ] 선택 등록 클릭 → 로딩 표시 ("등록 중...")
- [ ] 등록 완료 후 → 성공 메시지 표시
- [ ] 등록 완료 후 → 리스트 새로고침 (status 업데이트 확인)
- [ ] Shopify Dashboard에서 상품 확인
- [ ] 인증되지 않은 사용자 → 401 에러
- [ ] selling_price <= 0 → 등록 건너뛰고 에러 기록
- [ ] 대량 등록 시 → 순차적 처리 및 Rate Limit 대응

---

## 📄 관련 파일

- `app/api/shopify/bulk-upload/route.ts` - 일괄 등록 API
- `app/dashboard/page.tsx` - 대시보드 (handleBulkUpload 함수)
- `lib/shopify/client.ts` - Shopify API 클라이언트
- `types/index.ts` - ShopifyUploadResult 타입 정의

---

## 🎉 다음 단계

테스트가 모두 완료되면:

1. TODO.md 업데이트 (Phase 2.20-2.21 완료 체크)
2. Phase 3 (E2E 테스트 & 런칭) 준비
3. 버그 발견 시 Issue 생성 및 수정
