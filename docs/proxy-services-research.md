# 프록시 서비스 조사 보고서

**작성일:** 2024-12-03  
**목적:** Amazon Bot Detection 대응을 위한 프록시 서비스 옵션 조사  
**상태:** MVP 1.0에서는 프록시 없이 진행, 필요시 도입 예정

---

## 1. 프록시 서비스 개요

### 왜 프록시가 필요한가?

Amazon과 같은 대형 이커머스 사이트는 **Bot Detection 시스템**을 운영하여 자동화된 스크래핑을 차단합니다. 프록시 서비스는 다음과 같은 방법으로 이를 우회할 수 있습니다:

- **IP 순환 (IP Rotation):** 매 요청마다 다른 IP 주소 사용
- **지역별 IP 제공:** 타겟 국가의 실제 사용자처럼 보이게 함
- **CAPTCHA 우회:** 일부 서비스는 CAPTCHA 자동 해결 기능 제공

---

## 2. 주요 프록시 서비스 비교

### 2.1 Bright Data (구 Luminati)

**웹사이트:** https://brightdata.com

**특징:**
- ✅ 업계 최고 수준의 안정성 (99.99% Uptime)
- ✅ 7,200만+ IP 주소 보유
- ✅ Amazon 전용 최적화 옵션 제공
- ✅ 24/7 기술 지원
- ❌ 가격이 매우 높음 (최소 $500/월부터)

**가격:**
- Starter: $500/월 (40GB 데이터)
- Production: $1,000+/월

**추천 대상:** 대규모 운영, 안정성이 최우선인 기업

---

### 2.2 Oxylabs

**웹사이트:** https://oxylabs.io

**특징:**
- ✅ 기업용 솔루션, 안정성 우수
- ✅ 1억+ IP 주소 보유
- ✅ Amazon Scraper API 전용 상품 있음
- ✅ 무료 체험 가능 (7일)
- ❌ 가격대 높음 (최소 $300/월)

**가격:**
- Residential Proxies: $300/월 (8GB)
- E-Commerce Scraper API: Custom Pricing

**추천 대상:** 안정적인 기업용 솔루션을 원하는 경우

---

### 2.3 ScraperAPI

**웹사이트:** https://www.scraperapi.com

**특징:**
- ✅ **초보자 친화적** - 간단한 API 방식
- ✅ JavaScript 렌더링 지원
- ✅ CAPTCHA 자동 우회
- ✅ Amazon 전용 기능 제공
- ✅ 합리적인 가격
- ✅ 무료 플랜 있음 (1,000 requests/월)

**가격:**
- Hobby: $49/월 (100,000 requests)
- Startup: $149/월 (1,000,000 requests)
- Business: $299/월 (3,000,000 requests)

**추천 대상:** ⭐ **1인 셀러, MVP 단계 - 가장 추천**

**사용 예시:**
```typescript
// ScraperAPI 사용 예시
const apiKey = 'YOUR_API_KEY';
const targetUrl = 'https://www.amazon.com/s?k=neck+device';
const apiUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;

const response = await fetch(apiUrl);
const html = await response.text();
```

---

### 2.4 Smartproxy

**웹사이트:** https://smartproxy.com

**특징:**
- ✅ **가성비 최고**
- ✅ 4,000만+ IP 주소
- ✅ Amazon 스크래핑 지원
- ✅ 한글 문서 제공
- ✅ 무료 체험 가능 (3일)
- ⚠️ 안정성은 Bright Data보다 낮음

**가격:**
- Starter: $12.5/GB (최소 8GB = $100/월)
- Regular: $10/GB (최소 25GB = $250/월)

**추천 대상:** 비용 절감이 중요한 스타트업

---

## 3. MVP 1.0 전략 (프록시 없이 진행)

### 3.1 Bot Detection 회피 전략

프록시 없이도 다음 방법으로 Bot Detection을 최소화할 수 있습니다:

#### ✅ 이미 구현된 방법 (test-puppeteer.ts)

1. **User-Agent 설정**
```typescript
await page.setUserAgent(
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
);
```

2. **Headless 모드 최적화**
```typescript
{
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ]
}
```

#### 🔜 추가 구현 예정 (Phase 2)

3. **랜덤 딜레이 추가**
```typescript
// 페이지 간 1-3초 랜덤 대기
await new Promise(resolve => 
  setTimeout(resolve, 1000 + Math.random() * 2000)
);
```

4. **요청 간격 조절**
- 페이지네이션 시 2-3초 간격 유지
- 동시 요청 제한 (순차 처리)

5. **헤더 추가 설정**
```typescript
await page.setExtraHTTPHeaders({
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.amazon.com/',
});
```

### 3.2 언제 프록시를 도입할 것인가?

다음 상황이 발생하면 프록시 도입을 고려합니다:

- ❌ CAPTCHA가 자주 발생 (5회 중 2회 이상)
- ❌ IP 차단 발생 (403/429 에러)
- ❌ 데이터 수집 실패율 50% 이상
- ✅ 일일 수집량이 500개 이상으로 증가

**권장 순서:**
1. 무료 플랜 테스트: ScraperAPI (1,000 requests/월)
2. 유료 전환: ScraperAPI Hobby ($49/월)
3. 확장 필요 시: Smartproxy ($100/월)

---

## 4. 비용 시뮬레이션

### MVP 1.0 단계 (프록시 없음)

**예상 사용량:**
- 일일 수집 횟수: 10회
- 페이지당 상품 수: 30개
- 월 총 수집량: 10 × 30 × 30일 = 9,000개

**비용:** $0 (무료)

### v1.1 단계 (프록시 도입 시)

**예상 사용량:**
- 일일 수집 횟수: 20회
- 페이지당 상품 수: 50개
- 월 총 수집량: 20 × 50 × 30일 = 30,000개

**비용 옵션:**
1. ScraperAPI Hobby: $49/월 (100,000 requests)
2. Smartproxy Starter: $100/월 (8GB)

**권장:** ScraperAPI Hobby ($49/월) - 충분한 여유

---

## 5. 결론 및 권장사항

### ✅ 현재 단계 (MVP 1.0)

**프록시 사용하지 않음**

**이유:**
1. Puppeteer 테스트 결과 Amazon 접속 성공 확인
2. MVP 단계에서는 일일 수집량이 적음 (300개 이하)
3. User-Agent 설정 + 랜덤 딜레이로 충분히 대응 가능
4. 비용 절감 ($49/월 절약)

### 🔮 향후 계획 (v1.1 이후)

**ScraperAPI 도입 검토**

**조건:**
- Bot Detection 문제 발생 시
- 일일 수집량 500개 이상 증가 시

**예산:**
- 1단계: ScraperAPI 무료 플랜 테스트 (1,000 requests/월)
- 2단계: ScraperAPI Hobby 전환 ($49/월)

---

## 6. 참고 링크

- [Bright Data](https://brightdata.com)
- [Oxylabs](https://oxylabs.io)
- [ScraperAPI](https://www.scraperapi.com) ⭐ 추천
- [Smartproxy](https://smartproxy.com)
- [Puppeteer 공식 문서](https://pptr.dev)
- [Amazon Bot Detection 우회 베스트 프랙티스](https://blog.apify.com/web-scraping-amazon/)

---

**최종 업데이트:** 2024-12-03  
**다음 검토 예정:** v1.1 개발 시작 전 (2026-01-11)



