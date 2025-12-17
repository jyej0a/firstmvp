/**
 * @file lib/scraper/amazon-scraper.ts
 * @description 아마존 상품 데이터 스크래핑 로직
 *
 * 이 파일은 Puppeteer를 사용하여 아마존 검색 결과 페이지에서
 * 상품 정보를 추출하는 핵심 스크래핑 로직을 제공합니다.
 *
 * 주요 기능:
 * 1. 브라우저 초기화 및 Bot Detection 회피 (User-Agent 설정)
 * 2. 아마존 검색 결과 페이지 접속
 * 3. 상품 정보 추출 (ASIN, 제목, 이미지, 가격, URL)
 * 4. 페이지네이션 처리 (2-3 페이지, 30개까지 수집)
 * 5. 랜덤 딜레이로 자연스러운 사용자 행동 모방
 *
 * @see {@link /docs/PRD.md} - KPI: 30개 리스트업 30초 이내
 * @see {@link /docs/TODO.md#2.3} - 구현 계획
 */

import puppeteer, { Browser, Page } from "puppeteer";
import type { ScrapedProductRaw } from "@/types";

/**
 * 스크래핑 옵션 인터페이스
 */
export interface ScraperOptions {
  /** 수집할 최대 상품 개수 (기본값: 30) */
  maxProducts?: number;

  /** 타임아웃 시간 (밀리초, 기본값: 60000) */
  timeout?: number;

  /** 헤드리스 모드 (기본값: true) */
  headless?: boolean;

  /** 상세 로그 출력 여부 (기본값: false) */
  verbose?: boolean;
}

/**
 * 스크래핑 결과 인터페이스
 */
export interface ScrapingResult {
  /** 수집된 상품 목록 */
  products: ScrapedProductRaw[];

  /** 총 수집된 개수 */
  totalScraped: number;

  /** 소요 시간 (밀리초) */
  duration: number;

  /** 수집된 페이지 수 */
  pagesScraped: number;
}

/**
 * 랜덤 딜레이 상수
 * 프로덕션: 3-5초 (안전)
 * 개발: 1-3초 (빠른 테스트)
 */
const isProduction = process.env.NODE_ENV === "production";
const MIN_DELAY_MS = isProduction ? 3000 : 1000;
const MAX_DELAY_MS = isProduction ? 5000 : 3000;

/**
 * User-Agent 설정 (최신 Chrome 브라우저)
 */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * 랜덤 딜레이 함수 (1-3초 사이 대기)
 */
async function randomDelay(): Promise<void> {
  const delay = Math.floor(
    Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1) + MIN_DELAY_MS
  );
  console.log(`⏳ ${delay}ms 대기 중... (자연스러운 사용자 행동 모방)`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * 브라우저 초기화
 */
async function initBrowser(headless: boolean = true): Promise<Browser> {
  console.log("🌐 브라우저 초기화 중...");

  const browser = await puppeteer.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled", // Bot Detection 회피
    ],
  });

  console.log("✅ 브라우저 초기화 완료");
  return browser;
}

/**
 * 페이지 초기화 및 User-Agent 설정
 */
async function initPage(
  browser: Browser,
  timeout: number = 60000
): Promise<Page> {
  console.log("📄 새 페이지 생성 중...");

  const page = await browser.newPage();

  // User-Agent 설정 (Bot Detection 회피)
  await page.setUserAgent(USER_AGENT);
  console.log("✅ User-Agent 설정 완료");

  // 언어 및 통화 설정 (영어/달러로 고정)
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });
  
  // 쿠키 설정: 미국 사이트 및 달러 통화 강제
  await page.setCookie({
    name: 'i18n-prefs',
    value: 'USD',
    domain: '.amazon.com',
    path: '/',
  });
  await page.setCookie({
    name: 'lc-main',
    value: 'en_US',
    domain: '.amazon.com',
    path: '/',
  });
  console.log("✅ 언어 및 통화 설정 완료 (영어/달러)");

  // 타임아웃 설정
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  // 추가 Bot Detection 회피 설정
  await page.evaluateOnNewDocument(() => {
    // webdriver 속성 제거
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });

  return page;
}

/**
 * 아마존 검색 결과 페이지에서 상품 정보 추출
 */
async function extractProductsFromPage(
  page: Page,
  verbose: boolean = false
): Promise<ScrapedProductRaw[]> {
  console.log("🔍 상품 정보 추출 중...");

  // 디버그: 스크린샷 저장
  if (verbose) {
    const timestamp = Date.now();
    await page.screenshot({
      path: `public/test-screenshots/amazon-debug-${timestamp}.png`,
      fullPage: true,
    });
    console.log(`📸 디버그 스크린샷 저장: amazon-debug-${timestamp}.png`);
  }

  // 페이지 로드 대기 (검색 결과 컨테이너)
  try {
    await page.waitForSelector('[data-component-type="s-search-result"]', {
      timeout: 10000,
    });
  } catch (error) {
    console.warn("⚠️  기본 selector로 상품을 찾을 수 없습니다. 대체 selector 시도 중...");

    // 대체 selector 시도
    try {
      await page.waitForSelector('.s-result-item[data-asin]', {
        timeout: 10000,
      });
    } catch (fallbackError) {
      console.error("❌ 상품 컨테이너를 찾을 수 없습니다.");

      // 페이지 HTML 일부 출력
      const bodyHTML = await page.evaluate(() => {
        return document.body.innerHTML.substring(0, 500);
      });
      console.log("📄 페이지 HTML (처음 500자):", bodyHTML);

      throw new Error("상품 컨테이너를 찾을 수 없습니다. Amazon 페이지 구조가 변경되었을 수 있습니다.");
    }
  }

  // 상품 정보 추출 (다양한 selector 시도)
  const products = await page.evaluate((verboseMode) => {
    // 다양한 selector 패턴 시도
    const selectors = [
      '[data-component-type="s-search-result"]',
      '.s-result-item[data-asin]',
      '[data-asin]:not([data-asin=""])',
    ];

    let productElements: NodeListOf<Element> | null = null;

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        productElements = elements;
        if (verboseMode) {
          console.log(`✅ selector "${selector}"로 ${elements.length}개 상품 발견`);
        }
        break;
      }
    }

    if (!productElements || productElements.length === 0) {
      console.error("❌ 어떤 selector로도 상품을 찾을 수 없습니다.");
      return [];
    }

    const scrapedProducts: ScrapedProductRaw[] = [];

    productElements.forEach((element, index) => {
      try {
        // ASIN 추출 (여러 방법 시도)
        const asin =
          element.getAttribute("data-asin") ||
          element.getAttribute("data-uuid") || "";

        if (!asin || asin.length < 10) return; // 유효하지 않은 ASIN 스킵

        // 제목 추출 (여러 selector 시도)
        const titleSelectors = [
          "h2 a span",
          "h2 span",
          ".s-title-instructions-style h2 a span",
          "h2.s-line-clamp-2 a span",
        ];

        let title = "";
        for (const sel of titleSelectors) {
          const titleElement = element.querySelector(sel);
          if (titleElement?.textContent) {
            title = titleElement.textContent.trim();
            break;
          }
        }

        if (!title) return; // 제목이 없으면 스킵

        // 이미지 추출 (여러 이미지 수집)
        const images: string[] = [];

        // 1. 메인 썸네일 이미지
        const mainImage = element.querySelector("img.s-image, img[data-image-index='0']");
        if (mainImage?.getAttribute("src")) {
          images.push(mainImage.getAttribute("src")!);
        }

        // 2. srcset에서 고해상도 이미지 추출 (있는 경우)
        const srcset = mainImage?.getAttribute("srcset");
        if (srcset) {
          const srcsetUrls = srcset.split(",").map((item) => {
            const parts = item.trim().split(" ");
            return parts[0]; // URL만 추출
          });
          // 중복 제거하고 추가
          srcsetUrls.forEach((url) => {
            if (url && !images.includes(url)) {
              images.push(url);
            }
          });
        }

        // 3. 추가 이미지 (data-image-index 속성이 있는 경우)
        const additionalImages = element.querySelectorAll("img[data-image-index]");
        additionalImages.forEach((img) => {
          const src = img.getAttribute("src");
          if (src && !images.includes(src)) {
            images.push(src);
          }
        });

        // 최소 1개의 이미지는 있어야 함
        if (images.length === 0) return;

        // 가격 추출 (여러 selector 시도)
        const priceSelectors = [
          ".a-price .a-offscreen",           // 주요 가격 (숨겨진 텍스트)
          ".a-price-whole",                  // 정수 부분
          "span.a-price span[aria-hidden='true']", // 대체 가격
        ];

        let priceText = "";
        for (const sel of priceSelectors) {
          const elem = element.querySelector(sel);
          if (elem?.textContent) {
            priceText = elem.textContent.trim();
            break;
          }
        }

        // 가격 파싱: 달러 기호($)가 있는 가격만 사용
        // 원화 기호(₩, 원)가 있으면 경고하고 스킵
        const hasWonSymbol = /[₩원]/.test(priceText);
        const hasDollarSymbol = /\$/.test(priceText);
        
        if (hasWonSymbol && !hasDollarSymbol) {
          if (verboseMode) {
            console.warn(`  ⚠️  원화 가격 감지, 스킵: ${priceText} (제목: ${title.substring(0, 30)}...)`);
          }
          return; // 원화 가격은 스킵
        }

        // 달러 가격 파싱 (숫자와 소수점만 추출)
        const cleanPrice = priceText.replace(/[^0-9.]/g, "");
        const amazonPrice = cleanPrice ? parseFloat(cleanPrice) : 0;
        
        // 가격이 0이거나 비정상적으로 큰 경우(원화로 오인했을 가능성) 체크
        if (amazonPrice > 10000 && !hasDollarSymbol) {
          if (verboseMode) {
            console.warn(`  ⚠️  비정상적으로 큰 가격 감지, 스킵: ${amazonPrice} (제목: ${title.substring(0, 30)}...)`);
          }
          return; // 원화로 오인한 것 같으면 스킵
        }

        // URL 추출
        const linkElement = element.querySelector("h2 a, a.s-link-style");
        const relativeUrl = linkElement?.getAttribute("href") || "";
        const sourceUrl = relativeUrl
          ? `https://www.amazon.com${relativeUrl}`
          : "";

        // 유효성 검증 (가격이 0보다 커야 함)
        if (asin && title && sourceUrl && images.length > 0 && amazonPrice > 0) {
          scrapedProducts.push({
            asin,
            title,
            images,
            amazonPrice,
            sourceUrl,
          });

          if (verboseMode && index < 3) {
            console.log(`  ${index + 1}. ${title} (${asin}) - $${amazonPrice.toFixed(2)}`);
          }
        } else if (verboseMode && asin && title && amazonPrice <= 0) {
          // 가격이 0 이하인 경우 디버그 로그
          console.warn(`  ⚠️  가격 누락으로 건너뜀: ${title.substring(0, 50)}... (${asin})`);
        }
      } catch (error) {
        console.error("상품 추출 중 에러:", error);
      }
    });

    return scrapedProducts;
  }, verbose);

  console.log(`✅ ${products.length}개 상품 추출 완료`);
  return products;
}

/**
 * 다음 페이지로 이동
 */
async function goToNextPage(page: Page): Promise<boolean> {
  try {
    console.log("➡️  다음 페이지로 이동 시도 중...");

    // 다음 페이지 버튼 확인
    const nextButton = await page.$(".s-pagination-next:not(.s-pagination-disabled)");

    if (!nextButton) {
      console.log("❌ 다음 페이지 버튼 없음 (마지막 페이지)");
      return false;
    }

    // 랜덤 딜레이 (자연스러운 사용자 행동)
    await randomDelay();

    // 다음 페이지 클릭
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
      nextButton.click(),
    ]);

    console.log("✅ 다음 페이지 로드 완료");
    return true;
  } catch (error) {
    console.error("다음 페이지 이동 실패:", error);
    return false;
  }
}

/**
 * 1개 상품만 수집하는 함수 (순차 처리용)
 *
 * 검색 결과 페이지에서 특정 인덱스의 상품 하나만 추출합니다.
 * 페이지네이션을 고려하여 offset만큼 건너뛰고 해당 위치의 상품을 반환합니다.
 *
 * @param searchUrl - 아마존 검색 URL
 * @param offset - 건너뛸 상품 개수 (이미 수집한 상품 수)
 * @param options - 스크래핑 옵션
 * @returns 수집된 상품 (1개) 또는 null (수집 실패 시)
 *
 * @example
 * const product = await scrapeSingleProduct(
 *   "https://www.amazon.com/s?k=neck+device",
 *   5  // 5개 건너뛰고 6번째 상품 수집
 * );
 */
export async function scrapeSingleProduct(
  searchUrl: string,
  offset: number = 0,
  options: ScraperOptions = {}
): Promise<ScrapedProductRaw | null> {
  const { timeout = 60000, headless = true, verbose = false } = options;

  console.log(`🔍 [Single Product] offset=${offset} 상품 수집 시작`);

  let browser: Browser | null = null;

  try {
    // 1. 브라우저 초기화
    browser = await initBrowser(headless);
    const page = await initPage(browser, timeout);

    // 2. 페이지네이션 계산 (페이지당 약 16개 상품 가정)
    const productsPerPage = 16;
    const targetPage = Math.floor(offset / productsPerPage) + 1;
    const targetIndex = offset % productsPerPage;

    // 3. 해당 페이지로 이동
    if (targetPage > 1) {
      const pageUrl = new URL(searchUrl);
      pageUrl.searchParams.set("page", String(targetPage));
      const paginatedUrl = pageUrl.toString();

      console.log(`📄 페이지 ${targetPage}로 이동 (URL: ${paginatedUrl})`);
      await page.goto(paginatedUrl, {
        waitUntil: "networkidle2",
        timeout,
      });
    } else {
      console.log(`📄 첫 페이지 접속`);
      await page.goto(searchUrl, {
        waitUntil: "networkidle2",
        timeout,
      });
    }

    // 4. 페이지에서 상품 목록 추출
    const products = await extractProductsFromPage(page, verbose);

    if (products.length === 0) {
      console.warn("⚠️  페이지에 상품이 없습니다");
      return null;
    }

    // 5. 해당 인덱스의 상품 반환
    if (targetIndex >= products.length) {
      console.warn(
        `⚠️  인덱스 ${targetIndex}가 범위를 벗어남 (페이지 상품 수: ${products.length})`
      );
      return null;
    }

    const product = products[targetIndex];
    console.log(`✅ 상품 수집 완료: ${product.title.substring(0, 50)}...`);

    return product;
  } catch (error) {
    console.error("❌ 단일 상품 수집 실패:", error);
    throw error;
  } finally {
    // 브라우저 종료
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 아마존 상품 스크래핑 메인 함수
 *
 * @param searchUrl - 아마존 검색 URL (processSearchInput에서 생성된 URL)
 * @param options - 스크래핑 옵션
 * @returns 스크래핑 결과
 *
 * @example
 * const result = await scrapeAmazonProducts(
 *   "https://www.amazon.com/s?k=neck+device",
 *   { maxProducts: 30, verbose: true }
 * );
 */
export async function scrapeAmazonProducts(
  searchUrl: string,
  options: ScraperOptions = {}
): Promise<ScrapingResult> {
  const startTime = Date.now();
  const {
    maxProducts = 30,
    timeout = 60000,
    headless = true,
    verbose = false,
  } = options;

  console.group("🚀 아마존 스크래핑 시작");
  console.log(`📊 목표: 최대 ${maxProducts}개 상품 수집`);
  console.log(`🔗 URL: ${searchUrl}`);
  console.log(`⏱️  타임아웃: ${timeout}ms\n`);

  let browser: Browser | null = null;
  const allProducts: ScrapedProductRaw[] = [];
  let pagesScraped = 0;

  try {
    // 1. 브라우저 초기화
    browser = await initBrowser(headless);

    // 2. 페이지 생성 및 설정
    const page = await initPage(browser, timeout);

    // 3. 첫 페이지 접속
    console.log("🌍 아마존 검색 페이지 접속 중...");
    await page.goto(searchUrl, {
      waitUntil: "networkidle2",
      timeout,
    });
    console.log("✅ 페이지 접속 완료\n");

    // 4. 페이지별로 상품 수집 (30개까지)
    while (allProducts.length < maxProducts) {
      pagesScraped++;
      console.log(`\n📄 === 페이지 ${pagesScraped} 수집 중 ===`);

      // 현재 페이지에서 상품 추출
      const products = await extractProductsFromPage(page, verbose);

      // 중복 제거 (ASIN 기준)
      const existingAsins = new Set(allProducts.map((p) => p.asin));
      const newProducts = products.filter(
        (p) => !existingAsins.has(p.asin)
      );

      allProducts.push(...newProducts);
      console.log(`📦 현재까지 수집된 상품: ${allProducts.length}개`);

      // 목표 개수 달성 체크
      if (allProducts.length >= maxProducts) {
        console.log(`\n🎯 목표 개수(${maxProducts}개) 달성!`);
        break;
      }

      // 페이지네이션 제한 해제 (하루 최대 1000개 지원)
      // 더 이상 페이지가 없을 때까지 수집 가능

      // 다음 페이지로 이동
      const hasNextPage = await goToNextPage(page);
      if (!hasNextPage) {
        console.log("\n⚠️  더 이상 페이지가 없습니다.");
        break;
      }
    }

    // 5. 결과 요약
    const duration = Date.now() - startTime;
    const result: ScrapingResult = {
      products: allProducts.slice(0, maxProducts), // 최대 개수만큼만 반환
      totalScraped: allProducts.length,
      duration,
      pagesScraped,
    };

    console.log("\n" + "=".repeat(50));
    console.log("✨ 스크래핑 완료!");
    console.log(`📊 총 수집된 상품: ${result.totalScraped}개`);
    console.log(`⏱️  소요 시간: ${(duration / 1000).toFixed(2)}초`);
    console.log(`📄 수집된 페이지: ${pagesScraped}페이지`);
    console.log("=".repeat(50));

    // KPI 검증 (30초 이내 목표)
    if (duration > 30000) {
      console.warn(
        `⚠️  KPI 미달: 30초 이내 목표 (실제: ${(duration / 1000).toFixed(2)}초)`
      );
    } else {
      console.log("🎉 KPI 달성: 30초 이내 수집 성공!");
    }

    console.groupEnd();
    return result;
  } catch (error) {
    console.error("\n❌ 스크래핑 실패!");
    console.error("에러 내용:", error);

    if (error instanceof Error) {
      console.error(`메시지: ${error.message}`);
    }

    console.groupEnd();
    throw error;
  } finally {
    // 브라우저 종료
    if (browser) {
      await browser.close();
      console.log("🔚 브라우저 종료 완료");
    }
  }
}

/**
 * 스크래핑 결과를 콘솔에 상세 출력 (디버깅용)
 */
export function logScrapingResults(result: ScrapingResult): void {
  console.group("\n📋 수집된 상품 목록");

  result.products.forEach((product, index) => {
    console.group(`\n${index + 1}. ${product.title}`);
    console.log(`   ASIN: ${product.asin}`);
    console.log(`   가격: $${product.amazonPrice.toFixed(2)}`);
    console.log(`   이미지: ${product.images[0]}`);
    console.log(`   URL: ${product.sourceUrl}`);
    console.groupEnd();
  });

  console.groupEnd();
}

