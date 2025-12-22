# 멘토님께 드릴 질문 - 오류 처리 개선 (2025-12-22)

## 프로젝트 간단 소개

안녕하세요 멘토님!

저는 **Trend-Hybrid Admin**이라는 프로젝트를 진행하고 있습니다.

**프로젝트가 하는 일:**

- 아마존에서 상품 정보를 자동으로 가져와서 (스크래핑)
- Shopify 내 쇼핑몰에 자동으로 등록해주는 도구입니다

**기술 스택:**

- Next.js 15 (프론트엔드 + 백엔드)
- Supabase (PostgreSQL 데이터베이스)
- Puppeteer (아마존에서 상품 정보 가져오기)
- Shopify API (상품 등록)

**현재 상황:**

- 순차 처리 스크래핑 기능을 구현했습니다 (1분에 1개씩 수집)
- 스크래핑 중 오류가 발생할 때 더 자세한 정보를 저장하고 싶어서
- 오늘 데이터베이스에 오류 관련 필드들을 추가했습니다

---

## 오늘 한 작업

**데이터베이스 스키마 변경:**

- `scraping_job_items` 테이블에 다음 필드들을 추가했습니다:
  - `error_code` (TEXT): 오류 코드 (예: "TIMEOUT", "NETWORK_ERROR")
  - `error_reason` (TEXT): 오류 원인 (간단한 설명)
  - `error_detail` (TEXT): 오류 상세 정보 (스택 트레이스 등)
  - `failed_at` (TIMESTAMP): 오류 발생 시각

**현재 문제점:**

- 데이터베이스에는 필드를 추가했지만
- 실제 코드에서는 이 필드들을 사용하지 않고 있습니다
- 지금은 `error_message` 필드만 사용하고 있습니다

---

## 질문 1: 오류 분류 전략

**질문:**
스크래핑 중 발생할 수 있는 오류들을 어떻게 분류해야 할까요? `error_code`에 어떤 값들을 사용하는 게 좋을까요?

**현재 생각:**

- `TIMEOUT`: 페이지 로딩이 너무 오래 걸림
- `NETWORK_ERROR`: 네트워크 연결 실패
- `BOT_DETECTED`: 아마존이 봇으로 인식해서 차단
- `ELEMENT_NOT_FOUND`: 상품 정보를 찾을 수 없음
- `RATE_LIMIT_EXCEEDED`: 요청이 너무 많아서 차단
- `UNKNOWN_ERROR`: 알 수 없는 오류

**궁금한 점:**

- 이렇게 분류하는 게 적절한가요?
- 더 세분화해야 하나요? 아니면 더 단순화해야 하나요?
- 오류 코드를 어떻게 정의하는 게 유지보수에 좋을까요?

---

## 질문 2: 오류 정보 수집 방법

**질문:**
오류가 발생했을 때 `error_code`, `error_reason`, `error_detail`을 어떻게 채워야 할까요?

**현재 코드 상황:**

```typescript
// 현재는 이렇게만 하고 있습니다
catch (scrapeError) {
  await supabase
    .from("scraping_job_items")
    .update({
      status: "failed",
      error_message: scrapeError.message
    })
    .eq("id", jobItemId);
}
```

**궁금한 점:**

- `error_code`는 어떻게 결정하나요? 오류 메시지를 분석해서 자동으로 분류해야 하나요?
- `error_reason`은 사용자가 이해하기 쉬운 메시지로 작성해야 하나요?
- `error_detail`에는 스택 트레이스 전체를 넣어야 하나요? 아니면 필요한 부분만?
- 오류 타입별로 다른 정보를 저장해야 하나요?

---

## 질문 3: 오류 처리 유틸리티 함수

**질문:**
오류를 분류하고 저장하는 로직을 여러 곳에서 사용할 것 같은데, 유틸리티 함수로 만드는 게 좋을까요?

**예시:**

```typescript
// 이런 함수를 만들면 좋을까요?
function categorizeError(error: Error): {
  code: string;
  reason: string;
  detail: string;
} {
  // 오류를 분석해서 분류하는 로직
}
```

**궁금한 점:**

- 이런 유틸리티 함수를 만드는 게 좋은 방법인가요?
- 아니면 각 오류 발생 지점에서 직접 처리하는 게 나을까요?
- 오류 처리 로직을 어디에 두는 게 좋을까요? (`lib/utils/error-handler.ts` 같은 곳?)

---

## 질문 4: 오류 정보 활용 방법

**질문:**
저장한 오류 정보를 어떻게 활용하면 좋을까요? 사용자에게 어떻게 보여줘야 할까요?

**현재 생각:**

- 사용자 화면에 "5개 실패" 같은 숫자만 보여주고 있음
- 실패한 항목을 클릭하면 상세 정보를 볼 수 있게 하고 싶음

**궁금한 점:**

- 사용자 화면에는 어떤 정보를 보여줘야 하나요?
  - `error_code`만? `error_reason`만? 둘 다?
- `error_detail`은 개발자용으로만 보여주는 게 좋을까요?
- 실패한 항목을 재시도할 때, 이전 오류 정보를 참고해야 하나요?

---

## 질문 5: 오류 로깅 및 모니터링

**질문:**
오류 정보를 데이터베이스에 저장하는 것 외에, 로깅이나 모니터링을 어떻게 하면 좋을까요?

**현재 하고 있는 것:**

- `console.error()`로 콘솔에 로그 출력
- Discord로 오류 알림 전송 (일부만)

**궁금한 점:**

- 모든 오류를 Discord로 알려야 하나요? 아니면 특정 오류만?
- 오류 발생 빈도를 추적하려면 어떻게 해야 하나요?
- 같은 오류가 반복되면 경고를 보내는 게 좋을까요?
- 오류 로그를 별도로 저장해야 하나요? (데이터베이스 외에)

---

## 질문 6: 오류 재시도 전략

**질문:**
오류가 발생했을 때, 어떤 오류는 재시도하고 어떤 오류는 재시도하지 않는 게 좋을까요?

**현재 상황:**

- 스크래핑 실패 시 최대 2회 재시도 (지수 백오프)
- 모든 오류에 대해 동일하게 재시도

**궁금한 점:**

- `BOT_DETECTED` 오류는 재시도해도 또 실패할 가능성이 높은데, 재시도해야 하나요?
- `ELEMENT_NOT_FOUND`는 상품 페이지 구조가 바뀐 것일 수 있어서 재시도해도 소용없을 수 있는데...
- 오류 코드별로 다른 재시도 전략을 사용해야 하나요?
- 재시도 횟수도 오류별로 다르게 해야 하나요?

---

## 질문 7: 데이터베이스 인덱스 활용

**질문:**
오늘 `error_code`와 `failed_at`에 인덱스를 추가했는데, 이걸 어떻게 활용하면 좋을까요?

**추가한 인덱스:**

```sql
CREATE INDEX idx_scraping_job_items_error_code ON scraping_job_items (error_code);
CREATE INDEX idx_scraping_job_items_failed_at ON scraping_job_items (failed_at);
```

**궁금한 점:**

- 이 인덱스들을 활용해서 어떤 기능을 만들 수 있을까요?
  - 예: "최근 1주일 동안 TIMEOUT 오류가 몇 번 발생했는지" 같은 통계?
- 사용자 화면에 "오류별 통계"를 보여주는 게 유용할까요?
- 인덱스를 추가한 게 성능에 도움이 될까요? (오류가 자주 발생하지 않는다면 불필요할 수도?)

---

## 질문 8: 기존 코드와의 호환성

**질문:**
기존에 `error_message` 필드를 사용하는 코드가 있는데, 새로 추가한 필드들과 어떻게 통합해야 할까요?

**현재 상황:**

- 기존 코드: `error_message` 필드만 사용
- 새로 추가: `error_code`, `error_reason`, `error_detail`, `failed_at`

**궁금한 점:**

- `error_message` 필드를 그대로 두고 새 필드들을 추가로 사용해야 하나요?
- 아니면 `error_message`를 제거하고 새 필드들로 대체해야 하나요?
- 기존 데이터는 어떻게 처리해야 하나요? (마이그레이션?)

---

## 질문 9: 오류 처리 코드 작성 위치

**질문:**
오류를 분류하고 저장하는 코드를 어디에 작성해야 할까요?

**현재 코드 구조:**

- `lib/scraper/sequential-scraper.ts`: 순차 스크래핑 로직
- `lib/scraper/amazon-scraper.ts`: 아마존 스크래핑 로직
- `lib/utils/save-products.ts`: DB 저장 로직

**궁금한 점:**

- 오류 처리 로직을 각 파일에 분산시켜야 하나요?
- 아니면 중앙화된 오류 처리 함수를 만들어야 하나요?
- 오류 처리와 비즈니스 로직을 분리하는 게 좋을까요?

---

## 질문 10: 테스트 전략

**질문:**
오류 처리 로직을 테스트하려면 어떻게 해야 할까요?

**궁금한 점:**

- 다양한 오류 상황을 시뮬레이션하려면 어떻게 해야 하나요?
  - 예: 네트워크 오류, 타임아웃, 요소를 찾을 수 없는 경우
- 실제로 오류를 발생시켜서 테스트해야 하나요?
- Mock을 사용해서 테스트할 수 있을까요?

---

## 추가 정보

**관련 파일:**

- 스크래핑 로직: `lib/scraper/sequential-scraper.ts` (448-503줄: 오류 처리 부분)
- 데이터베이스 마이그레이션: `supabase/migrations/20251222_add_error_fields_to_scraping_job_items.sql`
- 타입 정의: `types/index.ts`

**현재 오류 처리 코드 위치:**

```typescript:448:503:lib/scraper/sequential-scraper.ts
catch (scrapeError) {
  // paused 상태로 인한 중단인지 확인
  const isPaused = scrapeError instanceof Error &&
    scrapeError.message === "Job이 일시 중지되었습니다";

  if (isPaused) {
    // paused 상태면 실패로 처리하지 않고 메인 루프로 돌아가서 paused 처리
    console.log(`⏸️  일시 중지로 인한 스크래핑 중단`);
    // Job Item 정리
    if (jobItemId) {
      await supabase
        .from("scraping_job_items")
        .delete()
        .eq("id", jobItemId);
    }
    // 메인 루프로 돌아가서 paused 상태 처리
    continue;
  }

  console.error("❌ 상품 수집 실패:", scrapeError);
  failedCount++;
  currentCount++;

  // Job Item 상태를 'failed'로 변경
  if (jobItemId) {
    await supabase
      .from("scraping_job_items")
      .update({
        status: "failed",
        error_message:
          scrapeError instanceof Error
            ? scrapeError.message
            : "알 수 없는 오류",
      })
      .eq("id", jobItemId);
  }

  // Job 상태 업데이트
  await updateJobProgress(jobId, currentCount, successCount, failedCount);

  // 🔔 Discord 오류 알림 (에러는 로그만 남기고 계속 진행)
  const errorMessage = scrapeError instanceof Error
    ? scrapeError.message
    : "알 수 없는 오류";

  sendDiscord({
    content: `❌ 스크래핑 오류 발생\n` +
      `Job ID: ${jobId}\n` +
      `오류: ${errorMessage}\n` +
      `현재 진행: ${currentCount}/${totalTarget}`
  }).catch(err => console.error('[Discord] 알림 전송 실패:', err));

  // 다음 상품으로 계속 진행
  lastRequestTime = Date.now();
  continue;
}
```

---

## 요약

**핵심 질문:**

1. 오류를 어떻게 분류하고 코드화할까요?
2. 오류 정보를 어떻게 수집하고 저장할까요?
3. 저장한 오류 정보를 어떻게 활용할까요?
4. 오류 처리 로직을 어떻게 구조화할까요?

**가장 궁금한 것:**

- 비개발자 입장에서 오류 처리를 어떻게 설계하는 게 좋을지
- 실무에서 사용하는 오류 처리 패턴이나 베스트 프랙티스

감사합니다! 🙏
