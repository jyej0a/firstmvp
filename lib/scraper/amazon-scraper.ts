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

  /** 영어 강제 설정 (V1 전용, 한글 상품명 방지) */
  forceEnglish?: boolean;
}

/**
 * 스크래핑 결과 인터페이스
 */
export interface ScrapingResult {
  /** 수집된 상품 목록 */
  products: ScrapedProductRaw[];

  /** 총 수집된 상품 개수 */
  totalScraped: number;

  /** 소요 시간 (밀리초) */
  duration: number;

  /** 수집한 페이지 수 */
  pagesScraped: number;
}

/**
 * 브라우저 초기화
 */
async function initBrowser(headless: boolean = true): Promise<Browser> {
  const browser = await puppeteer.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  });

  return browser;
}

/**
 * 페이지 초기화 및 Bot Detection 회피 설정
 */
async function initPage(
  browser: Browser,
  timeout: number = 60000,
  options?: { forceEnglish?: boolean }
): Promise<Page> {
  const page = await browser.newPage();

  // User-Agent 설정 (Bot Detection 회피)
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // 언어 설정 (한글 상품명 방지 - V1 전용)
  if (options?.forceEnglish) {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    
    // 브라우저 언어 설정도 영어로 강제
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'language', {
        get: () => 'en-US',
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });
  }

  // 뷰포트 설정
  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  // 타임아웃 설정
  page.setDefaultTimeout(timeout);

  return page;
}

/**
 * 아마존 페이지에 통화를 USD로 설정하는 쿠키 추가
 */
async function setCurrencyToUSD(page: Page): Promise<void> {
  try {
    // 아마존 도메인에 쿠키 설정
    await page.setCookie(
      {
        name: 'i18n-prefs',
        value: 'USD',
        domain: '.amazon.com',
        path: '/',
      },
      {
        name: 'lc-main',
        value: 'en_US',
        domain: '.amazon.com',
        path: '/',
      }
    );
  } catch (error) {
    // 쿠키 설정 실패 시 무시 (일부 환경에서 제한될 수 있음)
    console.warn('⚠️  통화 쿠키 설정 실패 (계속 진행):', error);
  }
}

/**
 * 아마존 검색 결과 페이지에서 ASIN만 추출 (중복 체크용)
 * 
 * @param page - Puppeteer Page 객체
 * @param offset - 시작 인덱스
 * @returns ASIN 문자열 또는 null
 */
export async function extractAsinFromPage(
  page: Page,
  offset: number = 0
): Promise<string | null> {
  // 페이지네이션 계산 (페이지당 약 16개 상품 가정)
  const productsPerPage = 16;
  const targetPage = Math.floor(offset / productsPerPage) + 1;
  const targetIndex = offset % productsPerPage;

  // 해당 페이지로 이동 (이미 페이지에 있다면 생략 가능)
  if (targetPage > 1) {
    const currentUrl = page.url();
    const pageUrl = new URL(currentUrl);
    pageUrl.searchParams.set("page", String(targetPage));
    await page.goto(pageUrl.toString(), {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
  }

  // 페이지에서 ASIN만 추출
  const asin = await page.evaluate((index) => {
    const selectors = [
      '[data-component-type="s-search-result"]',
      '.s-result-item',
    ];

    let productElements: Element[] = [];
    for (const selector of selectors) {
      productElements = Array.from(document.querySelectorAll(selector));
      if (productElements.length > 0) break;
    }

    if (index >= productElements.length) {
      return null;
    }

    const element = productElements[index];
    const asinValue =
      element.getAttribute("data-asin") ||
      element.getAttribute("data-uuid") ||
      "";

    return asinValue && asinValue.length >= 10 ? asinValue : null;
  }, targetIndex);

  return asin;
}

/**
 * 아마존 검색 결과 페이지에서 상품 정보 추출
 */
async function extractProductsFromPage(
  page: Page,
  verbose: boolean = false
): Promise<ScrapedProductRaw[]> {
  if (verbose) {
    console.log("📋 페이지에서 상품 정보 추출 중...");
  }

  // 디버깅: 스크린샷 저장 (verbose 모드일 때만)
  if (verbose) {
    try {
      const timestamp = Date.now();
      const screenshotPath = `public/test-screenshots/amazon-debug-${timestamp}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 디버깅 스크린샷 저장: ${screenshotPath}`);
    } catch (error) {
      console.warn("⚠️  스크린샷 저장 실패:", error);
    }
  }

  // 먼저 페이지에서 selector 테스트 (Node.js 콘솔에 출력)
  const selectors = [
    '[data-component-type="s-search-result"]',
    ".s-result-item",
    '[data-asin]:not([data-asin=""])',
    ".s-card-container",
    '[data-index]',
    ".s-result-list .s-result-item",
    '[data-cel-widget*="search_result"]',
    ".s-main-slot .s-result-item",
  ];

  if (verbose) {
    console.log("🔍 Selector 테스트 시작...");
    for (const selector of selectors) {
      try {
        const count = await page.$$eval(selector, (elements) => elements.length);
        console.log(`   "${selector}": ${count}개 요소`);
      } catch (error) {
        console.log(`   "${selector}": 에러 (${error})`);
      }
    }
  }

  // 상품 정보 추출 (다양한 selector 시도)
  const products = await page.evaluate((selectors, verboseMode) => {
    let productElements: Element[] = [];
    let usedSelector = "";
    
    for (const selector of selectors) {
      productElements = Array.from(document.querySelectorAll(selector));
      if (productElements.length > 0) {
        usedSelector = selector;
        break;
      }
    }

    // 디버깅 정보 수집
    const debugInfo = {
      url: window.location.href,
      title: document.title,
      allAsins: Array.from(document.querySelectorAll('[data-asin]')).length,
      hasSearchResult0: !!document.querySelector('[data-cel-widget="search_result_0"]'),
      hasResultList: !!document.querySelector('.s-result-list'),
      hasMainSlot: !!document.querySelector('.s-main-slot'),
    };

    if (productElements.length === 0) {
      return { products: [], debugInfo, usedSelector: "", debugLogs: [] };
    }
    
    // 디버깅 로그 수집 (Node.js 콘솔로 전달)
    const debugLogs: string[] = [];
    
    if (verboseMode) {
      debugLogs.push(`📊 ${usedSelector}로 ${productElements.length}개 요소 발견, 상품 정보 추출 시작...`);
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
          // 기존 (우선순위 높음)
          "h2 a span",
          "h2 span",
          ".s-title-instructions-style h2 a span",
          "h2.s-line-clamp-2 a span",
          
          // 확장 1: 다양한 h2 구조
          "h2 a",
          "h2 .a-text-normal",
          "h2.a-text-normal a",
          ".s-title a span",
          ".s-title span",
          
          // 확장 2: data 속성 기반
          "[data-cy='title-recipe'] span",
          "[data-cy='title-recipe'] a span",
          "[data-component-type='s-product-image'] + div h2 a span",
          
          // 확장 3: 일반적인 링크 구조
          "a.a-link-normal span.a-text-normal",
          "a.a-link-normal .a-text-normal",
          ".a-link-normal span",
          
          // 확장 4: 대체 구조
          ".s-result-item h2 a",
          ".s-result-item .s-title a",
          "[data-asin] h2 a span",
        ];

        let title = "";
        for (const sel of titleSelectors) {
          const titleElement = element.querySelector(sel);
          if (titleElement?.textContent) {
            title = titleElement.textContent.trim();
            break;
          }
        }

        // 디버깅: 제목 추출 시도 결과 로그
        if (verboseMode && !title) {
          debugLogs.push(`  📝 제목 추출 시도 (상품 ${index + 1}):`);
          for (const sel of titleSelectors) {
            const found = element.querySelector(sel);
            if (found) {
              const text = found.textContent?.trim();
              debugLogs.push(`     - "${sel}": ✅ 발견 (텍스트: "${text?.substring(0, 50)}...")`);
              break;
            } else {
              debugLogs.push(`     - "${sel}": ❌ 없음`);
            }
          }
        }

        if (!title) {
          if (verboseMode) {
            debugLogs.push(`  ⚠️  상품 ${index + 1} 건너뜀: 제목 없음`);
          }
          return; // 제목이 없으면 스킵
        }

        // 이미지 추출 (검색 결과 페이지에서 가능한 모든 이미지 수집)
        const images: string[] = [];
        const seenUrls = new Set<string>(); // 중복 체크용

        // 이미지 Selector 확장
        const imageSelectors = [
          // 기존
          "img.s-image",
          
          // 확장 1: 다양한 이미지 클래스
          "img[data-image-index]",
          ".s-image",
          "img.a-dynamic-image",
          ".a-carousel-card img",
          
          // 확장 2: data 속성 기반
          "img[data-src]",
          "img[data-old-src]",
          "[data-component-type='s-product-image'] img",
          
          // 확장 3: lazy loading 대응
          "img[src*='amazon']",
          "img[srcset]",
        ];

        // 1. 메인 썸네일 이미지 (여러 selector 시도)
        let mainImage: HTMLImageElement | null = null;
        for (const sel of imageSelectors) {
          mainImage = element.querySelector(sel);
          if (mainImage) break;
        }

        if (mainImage) {
          // src 속성
          const src = mainImage.getAttribute("src");
          if (src && !seenUrls.has(src)) {
            images.push(src);
            seenUrls.add(src);
          }

          // data-src 속성 (lazy loading)
          const dataSrc = mainImage.getAttribute("data-src");
          if (dataSrc && !seenUrls.has(dataSrc)) {
            images.push(dataSrc);
            seenUrls.add(dataSrc);
          }

          // srcset 속성 파싱
          const srcset = mainImage.getAttribute("srcset");
          if (srcset) {
            const srcsetUrls = srcset
              .split(",")
              .map((s) => s.trim().split(" ")[0])
              .filter((url) => url && !seenUrls.has(url));
            images.push(...srcsetUrls);
            srcsetUrls.forEach((url) => seenUrls.add(url));
          }
        }

        // 2. 추가 이미지 (hover 시 표시되는 이미지)
        const hoverImages = element.querySelectorAll("img[data-image-index]");
        hoverImages.forEach((img) => {
          const src = img.getAttribute("src");
          const dataSrc = img.getAttribute("data-src");
          if (src && !seenUrls.has(src)) {
            images.push(src);
            seenUrls.add(src);
          }
          if (dataSrc && !seenUrls.has(dataSrc)) {
            images.push(dataSrc);
            seenUrls.add(dataSrc);
          }
        });

        // 3. 갤러리 썸네일 이미지
        const galleryThumbnails = element.querySelectorAll(
          ".s-image-carousel img, .a-carousel-card img"
        );
        galleryThumbnails.forEach((img) => {
          const src = img.getAttribute("src");
          const dataSrc = img.getAttribute("data-src");
          if (src && !seenUrls.has(src)) {
            images.push(src);
            seenUrls.add(src);
          }
          if (dataSrc && !seenUrls.has(dataSrc)) {
            images.push(dataSrc);
            seenUrls.add(dataSrc);
          }
        });

        // 가격 추출 (여러 selector 시도)
        const priceSelectors = [
          ".a-price .a-offscreen",
          ".a-price-whole",
          ".a-price span",
          '[data-a-color="base"] span.a-offscreen',
        ];

        let priceText = "";
        for (const sel of priceSelectors) {
          const priceElement = element.querySelector(sel);
          if (priceElement?.textContent) {
            priceText = priceElement.textContent.trim();
            break;
          }
        }

        // 가격 파싱 (숫자만 추출)
        const cleanPrice = priceText.replace(/[^0-9.]/g, "");
        const amazonPrice = cleanPrice ? parseFloat(cleanPrice) : 0;

        // URL 추출 (여러 selector 시도)
        const urlSelectors = [
          // 기존
          "h2 a",
          "a.s-link-style",
          
          // 확장 1: 다양한 링크 구조
          "a.a-link-normal",
          ".s-title a",
          "[data-cy='title-recipe'] a",
          
          // 확장 2: href 패턴 기반
          "a[href*='/dp/']",
          "a[href*='/gp/product/']",
          "a[href*='/product/']",
          
          // 확장 3: 상대 경로 포함
          "a[href^='/']",
          
          // 확장 4: data 속성 기반
          "[data-component-type='s-product-image'] + div a",
          ".s-result-item a[href*='amazon.com']",
        ];

        let linkElement: Element | null = null;
        for (const sel of urlSelectors) {
          linkElement = element.querySelector(sel);
          if (linkElement) {
            break;
          }
        }

        const relativeUrl = linkElement?.getAttribute("href") || "";
        const sourceUrl = relativeUrl
          ? `https://www.amazon.com${relativeUrl}`
          : "";

        // 디버깅: URL 추출 시도 결과 로그
        if (verboseMode && !sourceUrl) {
          debugLogs.push(`  🔗 URL 추출 시도 (상품 ${index + 1}):`);
          for (const sel of urlSelectors) {
            const found = element.querySelector(sel);
            if (found) {
              const href = found.getAttribute("href");
              debugLogs.push(`     - "${sel}": ✅ 발견 (href: "${href?.substring(0, 50)}...")`);
              break;
            } else {
              debugLogs.push(`     - "${sel}": ❌ 없음`);
            }
          }
        }

        // 유효성 검증 (필수 필드 체크)
        // 필수: ASIN, 제목, URL, 가격
        if (asin && title && sourceUrl && amazonPrice > 0) {
          // 이미지가 없으면 빈 배열로 설정 (상세 페이지에서 수집 가능)
          const finalImages = images.length > 0 ? images : [];
          
          scrapedProducts.push({
            asin,
            title,
            images: finalImages,
            amazonPrice,
            sourceUrl,
          });

          if (verboseMode && index < 3) {
            debugLogs.push(`  ${index + 1}. ${title} (${asin}) - $${amazonPrice.toFixed(2)}`);
            if (images.length === 0) {
              debugLogs.push(`     ⚠️  이미지 없음 (상세 페이지에서 수집 시도 예정)`);
            }
          }
        } else {
          // 디버깅: 왜 상품이 제외되었는지 로그
          if (verboseMode) {
            const reasons = [];
            if (!asin) reasons.push("ASIN 없음");
            if (!title) reasons.push("제목 없음");
            if (!sourceUrl) reasons.push("URL 없음");
            if (amazonPrice <= 0) reasons.push("가격 없음");
            
            if (reasons.length > 0) {
              debugLogs.push(`  ⚠️  상품 ${index + 1} 건너뜀: ${reasons.join(", ")} (필수 조건 미충족)`);
            }
          }
        }
      } catch (error) {
        console.error("상품 추출 중 에러:", error);
      }
    });

    return { products: scrapedProducts, debugInfo, usedSelector, debugLogs };
  }, selectors, verbose);

  // Node.js 콘솔에 디버깅 정보 출력
  if (verbose) {
    // 브라우저 콘솔 로그를 Node.js 콘솔로 출력
    if (products.debugLogs && products.debugLogs.length > 0) {
      products.debugLogs.forEach((log) => console.log(log));
    }
    
    if (products.products.length === 0) {
      console.warn("⚠️  상품 요소를 찾을 수 없습니다");
      console.warn(`   - 현재 URL: ${products.debugInfo.url}`);
      console.warn(`   - 페이지 제목: ${products.debugInfo.title}`);
      console.warn(`   - data-asin 속성을 가진 요소: ${products.debugInfo.allAsins}개`);
      console.warn(`   - [data-cel-widget="search_result_0"]: ${products.debugInfo.hasSearchResult0 ? "존재" : "없음"}`);
      console.warn(`   - .s-result-list: ${products.debugInfo.hasResultList ? "존재" : "없음"}`);
      console.warn(`   - .s-main-slot: ${products.debugInfo.hasMainSlot ? "존재" : "없음"}`);
    }
  }

  const extractedProducts = products.products;

  console.log(`✅ ${extractedProducts.length}개 상품 추출 완료`);
  
  if (extractedProducts.length === 0 && verbose) {
    console.warn("⚠️  페이지에서 상품을 추출하지 못했습니다.");
    console.warn("   - 페이지 구조가 변경되었을 수 있습니다");
    console.warn("   - Bot detection으로 차단되었을 수 있습니다");
    console.warn("   - 페이지 로딩이 완료되지 않았을 수 있습니다");
  }

  // 이미지 중복 제거 적용 (검색 결과 페이지 내에서)
  const { deduplicateImages } = await import("@/lib/utils/image-deduplicator");
  const productsWithDeduplicatedImages = extractedProducts.map((product) => ({
    ...product,
    images: deduplicateImages(product.images),
  }));

  return productsWithDeduplicatedImages;
}

/**
 * 상세 페이지에서 카테고리 정보 추출
 * 
 * @param page - Puppeteer Page 객체
 * @param productUrl - 상품 상세 페이지 URL
 * @returns 카테고리 경로 문자열 (예: "Electronics > Computers > Laptops") 또는 null
 */
async function extractCategoryFromDetailPage(
  page: Page,
  productUrl: string
): Promise<string | null> {
  try {
    console.log(`📂 상세 페이지 카테고리 수집: ${productUrl}`);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1db7e51e-5a9c-42ce-96bd-48f9db3728f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'amazon-scraper.ts:616',message:'extractCategory: checking URL',data:{currentUrl:page.url(),targetUrl:productUrl,needsGoto:page.url()!==productUrl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // 이미 해당 페이지에 있다면 다시 이동하지 않음
    if (page.url() !== productUrl) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1db7e51e-5a9c-42ce-96bd-48f9db3728f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'amazon-scraper.ts:620',message:'extractCategory: calling page.goto',data:{targetUrl:productUrl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      await page.goto(productUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      // 페이지 로드 대기
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const category = await page.evaluate(() => {
      // 방법 1: Breadcrumb 추출 (#wayfinding-breadcrumbs_feature_div)
      const breadcrumbSelectors = [
        "#wayfinding-breadcrumbs_feature_div",
        "#nav-breadcrumb",
        ".a-breadcrumb",
        "[data-testid='breadcrumb']",
        ".a-unordered-list.a-horizontal.a-size-small",
      ];

      for (const selector of breadcrumbSelectors) {
        const breadcrumb = document.querySelector(selector);
        if (breadcrumb) {
          // 링크 텍스트 추출
          const links = breadcrumb.querySelectorAll("a");
          if (links.length > 0) {
            const categories: string[] = [];
            links.forEach((link) => {
              const text = link.textContent?.trim();
              // "Home"이나 "All" 같은 일반적인 항목 제외
              if (text && !text.match(/^(Home|All|See all|Back to results)$/i)) {
                categories.push(text);
              }
            });
            if (categories.length > 0) {
              return categories.join(" > ");
            }
          }
        }
      }

      // 방법 2: 메타데이터에서 추출
      const metaCategory = document.querySelector('meta[name="category"]');
      if (metaCategory) {
        const content = metaCategory.getAttribute("content");
        if (content) {
          return content;
        }
      }

      // 방법 3: 페이지 제목이나 다른 메타 정보에서 추출 시도
      const pageTitle = document.title;
      // 제목에서 카테고리 패턴 찾기 (예: "Amazon.com: Electronics > Computers > Laptops")
      const titleMatch = pageTitle.match(/:\s*([^:]+)$/);
      if (titleMatch) {
        return titleMatch[1].trim();
      }

      return null;
    });

    if (category) {
      console.log(`✅ 카테고리 추출 성공: ${category}`);
      return category;
    } else {
      console.warn(`⚠️  카테고리 추출 실패: ${productUrl}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 카테고리 추출 중 에러: ${productUrl}`, error);
    return null;
  }
}

/**
 * 상품 상세 페이지에서 이미지 갤러리 수집
 *
 * @param page - Puppeteer Page 객체
 * @param productUrl - 상품 상세 페이지 URL
 * @returns 이미지 URL 배열
 */
async function extractImagesFromDetailPage(
  page: Page,
  productUrl: string
): Promise<string[]> {
  try {
    console.log(`📸 상세 페이지 이미지 수집: ${productUrl}`);
    await page.goto(productUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // 페이지 로드 대기
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const images = await page.evaluate(() => {
      const imageUrls: string[] = [];
      const seenUrls = new Set<string>();

      // 1. 메인 상품 이미지
      const mainImageSelectors = [
        "#landingImage",
        "#main-image",
        "#imgBlkFront",
        ".a-dynamic-image",
      ];

      for (const selector of mainImageSelectors) {
        const img = document.querySelector(selector);
        if (img) {
          const src = img.getAttribute("src");
          if (src && !seenUrls.has(src)) {
            imageUrls.push(src);
            seenUrls.add(src);
          }
        }
      }

      // 2. 이미지 갤러리 썸네일
      const thumbnails = document.querySelectorAll(
        "#imageBlock_feature_div img, #altImages ul li img, .a-dynamic-image"
      );
      thumbnails.forEach((thumb) => {
        const src = thumb.getAttribute("src");
        const dataSrc = thumb.getAttribute("data-src");
        const dataOldSrc = thumb.getAttribute("data-old-src");

        // 썸네일 URL을 고해상도 URL로 변환
        const convertToHighRes = (url: string): string => {
          if (!url) return url;
          // 썸네일 패턴을 고해상도 패턴으로 변환
          return url
            .replace(/_AC_SL\d+_/g, "_AC_SL1500_")
            .replace(/_AC_US\d+_/g, "_AC_SL1500_")
            .replace(/_AC_SR\d+,\d+_/g, "_AC_SL1500_")
            .replace(/_AC_UL\d+_/g, "_AC_SL1500_");
        };

        if (src) {
          const highResUrl = convertToHighRes(src);
          if (highResUrl && !seenUrls.has(highResUrl)) {
            imageUrls.push(highResUrl);
            seenUrls.add(highResUrl);
          }
        }
        if (dataSrc) {
          const highResUrl = convertToHighRes(dataSrc);
          if (highResUrl && !seenUrls.has(highResUrl)) {
            imageUrls.push(highResUrl);
            seenUrls.add(highResUrl);
          }
        }
        if (dataOldSrc) {
          const highResUrl = convertToHighRes(dataOldSrc);
          if (highResUrl && !seenUrls.has(highResUrl)) {
            imageUrls.push(highResUrl);
            seenUrls.add(highResUrl);
          }
        }
      });

      // 3. 상품 설명 섹션의 이미지
      const descriptionImages = document.querySelectorAll(
        "#productDescription img, #feature-bullets img"
      );
      descriptionImages.forEach((img) => {
        const src = img.getAttribute("src");
        if (src && !seenUrls.has(src)) {
          imageUrls.push(src);
          seenUrls.add(src);
        }
      });

      return imageUrls;
    });

    // 상세 페이지 내에서도 중복 제거
    const { deduplicateImages } = await import("@/lib/utils/image-deduplicator");
    return deduplicateImages(images);
  } catch (error) {
    console.error("상세 페이지 이미지 수집 실패:", error);
    return [];
  }
}

/**
 * 상세 페이지에서 상품 설명 추출
 * 
 * @param page - Puppeteer Page 객체
 * @param productUrl - 상품 상세 페이지 URL
 * @returns 상품 설명 (HTML 또는 텍스트) 또는 null
 */
async function extractDescriptionFromDetailPage(
  page: Page,
  productUrl: string
): Promise<string | null> {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1db7e51e-5a9c-42ce-96bd-48f9db3728f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'amazon-scraper.ts:823',message:'extractDescription: checking URL',data:{currentUrl:page.url(),targetUrl:productUrl,needsGoto:page.url()!==productUrl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // 이미 해당 페이지에 있다면 다시 이동하지 않음
    if (page.url() !== productUrl) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1db7e51e-5a9c-42ce-96bd-48f9db3728f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'amazon-scraper.ts:825',message:'extractDescription: calling page.goto',data:{targetUrl:productUrl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      await page.goto(productUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const description = await page.evaluate(() => {
      // 방법 1: productDescription 섹션
      const descriptionSelectors = [
        "#productDescription",
        "#feature-bullets",
        "#productDescription_feature_div",
        "#productDescription_feature_div .a-section",
        ".productDescriptionWrapper",
      ];

      for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          // HTML 형태로 반환 (Shopify body_html에 사용)
          const html = element.innerHTML?.trim();
          if (html && html.length > 10) {
            return html;
          }
        }
      }

      // 방법 2: 텍스트만 추출
      const textSelectors = [
        "#productDescription p",
        "#feature-bullets ul li",
        ".a-unordered-list.a-vertical.a-spacing-mini li",
      ];

      for (const selector of textSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const texts: string[] = [];
          elements.forEach((el) => {
            const text = el.textContent?.trim();
            if (text && text.length > 0) {
              texts.push(text);
            }
          });
          if (texts.length > 0) {
            return texts.join("\n");
          }
        }
      }

      return null;
    });

    if (description) {
      console.log(`✅ 상품 설명 추출 성공 (길이: ${description.length})`);
      return description;
    } else {
      console.warn(`⚠️  상품 설명 추출 실패: ${productUrl}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 상품 설명 추출 중 에러: ${productUrl}`, error);
    return null;
  }
}

/**
 * 상세 페이지에서 옵션 정보 (variants) 추출
 * 
 * @param page - Puppeteer Page 객체
 * @param productUrl - 상품 상세 페이지 URL
 * @returns 옵션 정보 배열 (예: ["Color: Black", "Size: Large"]) 또는 null
 */
async function extractVariantsFromDetailPage(
  page: Page,
  productUrl: string
): Promise<string[] | null> {
  try {
    // 이미 해당 페이지에 있다면 다시 이동하지 않음
    if (page.url() !== productUrl) {
      await page.goto(productUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const variants = await page.evaluate(() => {
      const variantList: string[] = [];

      // 방법 1: 색상 옵션
      const colorSelectors = [
        "#variation_color_name",
        "#variation_color_name ul li",
        "[data-attribute-name='color_name']",
        ".a-button-selected[data-attribute-name='color_name']",
      ];

      for (const selector of colorSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const selectedColor = element.getAttribute("title") || element.textContent?.trim();
          if (selectedColor) {
            variantList.push(`Color: ${selectedColor}`);
            break;
          }
        }
      }

      // 방법 2: 크기 옵션
      const sizeSelectors = [
        "#variation_size_name",
        "#variation_size_name ul li",
        "[data-attribute-name='size_name']",
        ".a-button-selected[data-attribute-name='size_name']",
      ];

      for (const selector of sizeSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const selectedSize = element.getAttribute("title") || element.textContent?.trim();
          if (selectedSize) {
            variantList.push(`Size: ${selectedSize}`);
            break;
          }
        }
      }

      // 방법 3: 일반적인 variation 선택자
      const variationElements = document.querySelectorAll(
        "[id^='variation_'], [data-attribute-name]"
      );
      variationElements.forEach((el) => {
        const attrName = el.getAttribute("data-attribute-name");
        const value = el.getAttribute("title") || el.textContent?.trim();
        if (attrName && value && !variantList.some((v) => v.startsWith(`${attrName}:`))) {
          variantList.push(`${attrName}: ${value}`);
        }
      });

      return variantList.length > 0 ? variantList : null;
    });

    if (variants && variants.length > 0) {
      console.log(`✅ 옵션 정보 추출 성공: ${variants.join(", ")}`);
      return variants;
    } else {
      console.warn(`⚠️  옵션 정보 추출 실패: ${productUrl}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 옵션 정보 추출 중 에러: ${productUrl}`, error);
    return null;
  }
}

/**
 * 상세 페이지에서 리뷰 개수 추출
 * 
 * @param page - Puppeteer Page 객체
 * @param productUrl - 상품 상세 페이지 URL
 * @returns 리뷰 개수 또는 null
 */
async function extractReviewCountFromDetailPage(
  page: Page,
  productUrl: string
): Promise<number | null> {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1db7e51e-5a9c-42ce-96bd-48f9db3728f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'amazon-scraper.ts:1002',message:'extractReviewCount: checking URL',data:{currentUrl:page.url(),targetUrl:productUrl,needsGoto:page.url()!==productUrl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // 이미 해당 페이지에 있다면 다시 이동하지 않음
    if (page.url() !== productUrl) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1db7e51e-5a9c-42ce-96bd-48f9db3728f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'amazon-scraper.ts:1004',message:'extractReviewCount: calling page.goto',data:{targetUrl:productUrl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      await page.goto(productUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const reviewCount = await page.evaluate(() => {
      // 방법 1: #acrCustomerReviewText
      const reviewTextSelectors = [
        "#acrCustomerReviewText",
        "#acrCustomerReviewLink",
        "#reviewsMedley h2",
        "[data-hook='total-review-count']",
        ".a-size-base.a-color-secondary",
      ];

      for (const selector of reviewTextSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent || element.innerText;
          if (text) {
            // 숫자 추출 (예: "1,234 ratings" 또는 "1,234 reviews")
            const match = text.match(/([\d,]+)/);
            if (match) {
              const count = parseInt(match[1].replace(/,/g, ""), 10);
              if (!isNaN(count) && count > 0) {
                return count;
              }
            }
          }
        }
      }

      return null;
    });

    if (reviewCount !== null) {
      console.log(`✅ 리뷰 개수 추출 성공: ${reviewCount}`);
      return reviewCount;
    } else {
      console.warn(`⚠️  리뷰 개수 추출 실패: ${productUrl}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 리뷰 개수 추출 중 에러: ${productUrl}`, error);
    return null;
  }
}

/**
 * 상세 페이지에서 평점 추출
 * 
 * @param page - Puppeteer Page 객체
 * @param productUrl - 상품 상세 페이지 URL
 * @returns 평점 (0-5 범위) 또는 null
 */
async function extractRatingFromDetailPage(
  page: Page,
  productUrl: string
): Promise<number | null> {
  try {
    // 이미 해당 페이지에 있다면 다시 이동하지 않음
    if (page.url() !== productUrl) {
      await page.goto(productUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const rating = await page.evaluate(() => {
      // 방법 1: #acrPopover
      const ratingSelectors = [
        "#acrPopover",
        "#acrCustomerReviewLink",
        ".a-icon-alt",
        "[data-hook='rating-out-of-text']",
        ".a-size-base.a-color-base",
      ];

      for (const selector of ratingSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent || element.getAttribute("title") || element.innerText;
          if (text) {
            // "4.5 out of 5" 또는 "4.5" 패턴 추출
            const match = text.match(/(\d+\.?\d*)\s*(?:out of\s*)?5/);
            if (match) {
              const ratingValue = parseFloat(match[1]);
              if (!isNaN(ratingValue) && ratingValue >= 0 && ratingValue <= 5) {
                return ratingValue;
              }
            }
            // 단순 숫자 패턴 (예: "4.5")
            const simpleMatch = text.match(/(\d+\.?\d*)/);
            if (simpleMatch) {
              const ratingValue = parseFloat(simpleMatch[1]);
              if (!isNaN(ratingValue) && ratingValue >= 0 && ratingValue <= 5) {
                return ratingValue;
              }
            }
          }
        }
      }

      return null;
    });

    if (rating !== null) {
      console.log(`✅ 평점 추출 성공: ${rating}`);
      return rating;
    } else {
      console.warn(`⚠️  평점 추출 실패: ${productUrl}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 평점 추출 중 에러: ${productUrl}`, error);
    return null;
  }
}

/**
 * 상세 페이지에서 브랜드명 추출
 * 
 * @param page - Puppeteer Page 객체
 * @param productUrl - 상품 상세 페이지 URL
 * @returns 브랜드명 또는 null
 */
async function extractBrandFromDetailPage(
  page: Page,
  productUrl: string
): Promise<string | null> {
  try {
    // 이미 해당 페이지에 있다면 다시 이동하지 않음
    if (page.url() !== productUrl) {
      await page.goto(productUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const brand = await page.evaluate(() => {
      // 방법 1: #bylineInfo
      const brandSelectors = [
        "#bylineInfo",
        ".po-brand",
        "#brand",
        "[data-brand]",
        ".a-link-normal[href*='/s?k=']",
        "#productTitle + .a-link-normal",
      ];

      for (const selector of brandSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim() || element.getAttribute("data-brand");
          if (text && text.length > 0 && text.length < 100) {
            // "Visit the [Brand] Store" 같은 패턴에서 브랜드명만 추출
            const brandMatch = text.match(/Visit the (.+?) Store/i);
            if (brandMatch) {
              return brandMatch[1].trim();
            }
            // 일반적인 브랜드명
            return text;
          }
        }
      }

      return null;
    });

    if (brand) {
      console.log(`✅ 브랜드명 추출 성공: ${brand}`);
      return brand;
    } else {
      console.warn(`⚠️  브랜드명 추출 실패: ${productUrl}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 브랜드명 추출 중 에러: ${productUrl}`, error);
    return null;
  }
}

/**
 * 상세 페이지에서 무게 정보 추출
 * 
 * @param page - Puppeteer Page 객체
 * @param productUrl - 상품 상세 페이지 URL
 * @returns 무게 (킬로그램 단위) 또는 null
 */
async function extractWeightFromDetailPage(
  page: Page,
  productUrl: string
): Promise<number | null> {
  try {
    // 이미 해당 페이지에 있다면 다시 이동하지 않음
    if (page.url() !== productUrl) {
      await page.goto(productUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const weight = await page.evaluate(() => {
      // "Item Weight" 또는 "Product Dimensions" 섹션 찾기
      const productDetailsSelectors = [
        "#productDetails_techSpec_section_1",
        "#productDetails_feature_div",
        ".prodDetTable",
        "#detailBullets_feature_div",
      ];

      for (const selector of productDetailsSelectors) {
        const section = document.querySelector(selector);
        if (section) {
          const text = section.textContent || section.innerText;
          if (text) {
            // "Item Weight" 패턴 찾기
            const weightMatch = text.match(/Item Weight[:\s]+([\d.]+)\s*(pounds?|lbs?|ounces?|oz|kilograms?|kg|grams?|g)/i);
            if (weightMatch) {
              const value = parseFloat(weightMatch[1]);
              const unit = weightMatch[2].toLowerCase();

              // 단위 변환 (킬로그램으로 통일)
              if (unit.includes("pound") || unit.includes("lb")) {
                return value * 0.453592; // 파운드 → 킬로그램
              } else if (unit.includes("ounce") || unit.includes("oz")) {
                return value * 0.0283495; // 온스 → 킬로그램
              } else if (unit.includes("gram") || unit.includes("g")) {
                return value / 1000; // 그램 → 킬로그램
              } else if (unit.includes("kilogram") || unit.includes("kg")) {
                return value; // 이미 킬로그램
              }
            }
          }
        }
      }

      return null;
    });

    if (weight !== null) {
      console.log(`✅ 무게 추출 성공: ${weight.toFixed(3)} kg`);
      return parseFloat(weight.toFixed(3));
    } else {
      console.warn(`⚠️  무게 추출 실패: ${productUrl}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ 무게 추출 중 에러: ${productUrl}`, error);
    return null;
  }
}

/**
 * 단일 상품 수집 (순차 처리용)
 *
 * @param searchUrl - 아마존 검색 URL
 * @param offset - 시작 인덱스 (0부터 시작)
 * @param options - 스크래핑 옵션
 * @returns 수집된 상품 정보 또는 null
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
    
    // 2. 페이지 생성 및 설정 (영어/달러 강제 설정)
    // 가격이 필수 필드이므로 달러 가격만 추출하기 위해 영어/달러 강제
    const page = await initPage(browser, timeout, { forceEnglish: true });

    // 3. 통화를 USD로 설정 (페이지 접속 전 쿠키 설정)
    await setCurrencyToUSD(page);

    // 4. 페이지네이션 계산 (페이지당 약 16개 상품 가정)
    const productsPerPage = 16;
    const targetPage = Math.floor(offset / productsPerPage) + 1;
    const targetIndex = offset % productsPerPage;

    // 5. URL에 언어 및 통화 파라미터 추가
    const finalUrl = (() => {
      const url = new URL(searchUrl);
      // 언어 파라미터 추가 (없는 경우에만)
      if (!url.searchParams.has('language')) {
        url.searchParams.set('language', 'en_US');
      }
      // 통화 파라미터 확인 및 추가
      if (!url.searchParams.has('currency')) {
        url.searchParams.set('currency', 'USD');
      }
      return url.toString();
    })();

    // 6. 해당 페이지로 이동
    if (targetPage > 1) {
      const pageUrl = new URL(finalUrl);
      pageUrl.searchParams.set("page", String(targetPage));
      const paginatedUrl = pageUrl.toString();

      console.log(`📄 페이지 ${targetPage}로 이동 (URL: ${paginatedUrl})`);
      await page.goto(paginatedUrl, {
        waitUntil: "networkidle2",
        timeout,
      });
    } else {
      console.log(`📄 첫 페이지 접속`);
      await page.goto(finalUrl, {
        waitUntil: "networkidle2",
        timeout,
      });
    }

    // 4. 페이지 로딩 후 추가 대기 (동적 콘텐츠 로딩 대기)
    // 스크롤을 내려서 lazy loading된 콘텐츠 로드
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 2초 추가 대기
    
    // 다시 위로 스크롤 (상품 목록이 보이도록)
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 추가 대기

    // 5. 페이지에서 상품 목록 추출
    const products = await extractProductsFromPage(page, verbose);

    if (products.length === 0) {
      console.warn(`⚠️  페이지에 상품이 없습니다 (offset: ${offset}, 페이지: ${targetPage})`);
      console.warn(`   - URL: ${page.url()}`);
      console.warn(`   - 페이지 로딩 상태 확인 필요`);
      return null;
    }

    // 6. 해당 인덱스의 상품 반환
    let product: ScrapedProductRaw;
    
    if (targetIndex >= products.length) {
      console.warn(
        `⚠️  인덱스 ${targetIndex}가 범위를 벗어남 (페이지 상품 수: ${products.length}, offset: ${offset})`
      );
      console.warn(`   - 페이지에는 ${products.length}개의 유효한 상품만 추출됨`);
      console.warn(`   - 필터링 과정에서 일부 상품이 제외되었을 수 있음`);
      console.warn(`   - 요청한 인덱스: ${targetIndex}, 추출된 상품 수: ${products.length}`);
      
      // null을 반환하지 않고, 가장 가까운 유효한 상품 반환 (마지막 상품)
      if (products.length > 0) {
        console.warn(`   - 대신 마지막 유효한 상품 반환 (인덱스: ${products.length - 1})`);
        product = products[products.length - 1];
      } else {
        // 상품이 하나도 없으면 null 반환 (이 경우는 재시도 필요)
        console.warn(`   - 유효한 상품이 없어 null 반환`);
        return null;
      }
    } else {
      product = products[targetIndex];
    }

    // 상세 페이지에서 추가 정보 수집 (이미지, 카테고리, 설명, 옵션, 리뷰수, 평점, 브랜드명, 무게)
    if (product.sourceUrl) {
      console.log(`📦 상세 페이지 추가 정보 수집 시작: ${product.sourceUrl}`);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1db7e51e-5a9c-42ce-96bd-48f9db3728f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'amazon-scraper.ts:1363',message:'Before page.goto',data:{currentUrl:page.url(),targetUrl:product.sourceUrl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // 상세 페이지로 이동 (한 번만 이동하여 모든 정보 수집)
      if (page.url() !== product.sourceUrl) {
        await page.goto(product.sourceUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1db7e51e-5a9c-42ce-96bd-48f9db3728f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'amazon-scraper.ts:1377',message:'After page.goto',data:{currentUrl:page.url()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // 병렬로 모든 정보 수집 (페이지는 이미 로드되어 있으므로 page.evaluate만 사용)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1db7e51e-5a9c-42ce-96bd-48f9db3728f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'amazon-scraper.ts:1384',message:'Starting Promise.all',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      const [
        detailImages,
        category,
        description,
        variants,
        reviewCount,
        rating,
        brand,
        weight,
      ] = await Promise.all([
        extractImagesFromDetailPage(page, product.sourceUrl),
        extractCategoryFromDetailPage(page, product.sourceUrl),
        extractDescriptionFromDetailPage(page, product.sourceUrl),
        extractVariantsFromDetailPage(page, product.sourceUrl),
        extractReviewCountFromDetailPage(page, product.sourceUrl),
        extractRatingFromDetailPage(page, product.sourceUrl),
        extractBrandFromDetailPage(page, product.sourceUrl),
        extractWeightFromDetailPage(page, product.sourceUrl),
      ]);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1db7e51e-5a9c-42ce-96bd-48f9db3728f6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'amazon-scraper.ts:1407',message:'Promise.all completed',data:{category,reviewCount,rating,brand,weight,hasDescription:!!description,variantsCount:variants?.length||0,imagesCount:detailImages?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      // 이미지 병합 및 중복 제거
      const { deduplicateImages } = await import("@/lib/utils/image-deduplicator");
      const allImages = deduplicateImages([...product.images, ...detailImages]);
      product.images = allImages;

      // 나머지 필드 할당
      if (category) product.category = category;
      if (description) product.description = description;
      if (variants && variants.length > 0) product.variants = variants;
      if (reviewCount !== null) product.reviewCount = reviewCount;
      if (rating !== null) product.rating = rating;
      if (brand) product.brand = brand;
      if (weight !== null) product.weight = weight;

      console.log(`✅ 상세 페이지 추가 정보 수집 완료`);
    }

    console.log(
      `✅ 상품 수집 완료: ${product.title.substring(0, 50)}... (이미지 ${product.images.length}개)`
    );

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
 * 다음 페이지로 이동
 */
async function goToNextPage(page: Page): Promise<boolean> {
  try {
    // 다음 페이지 버튼 찾기
    const nextButton = await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll('a[aria-label="Go to next page"]')
      );
      return buttons.length > 0;
    });

    if (!nextButton) {
      return false;
    }

    // 다음 페이지 버튼 클릭
    await page.click('a[aria-label="Go to next page"]');
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });

    // 랜덤 딜레이 (1-3초)
    const delay = Math.floor(Math.random() * 2000) + 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    return true;
  } catch (error) {
    console.error("다음 페이지 이동 실패:", error);
    return false;
  }
}

/**
 * 아마존 상품 일괄 수집 (기존 방식, V1용)
 *
 * @param searchUrl - 아마존 검색 URL
 * @param options - 스크래핑 옵션
 * @returns 수집 결과
 */
export async function scrapeAmazonProducts(
  searchUrl: string,
  options: ScraperOptions = {}
): Promise<ScrapingResult> {
  const {
    maxProducts = 30,
    timeout = 60000,
    headless = true,
    verbose = false,
  } = options;

  const startTime = Date.now();
  let browser: Browser | null = null;
  const allProducts: ScrapedProductRaw[] = [];
  let pagesScraped = 0;

  try {
    // 1. 브라우저 초기화
    browser = await initBrowser(headless);

    // 2. 페이지 생성 및 설정 (영어/달러 강제 설정)
    // 가격이 필수 필드이므로 달러 가격만 추출하기 위해 영어/달러 강제
    const page = await initPage(browser, timeout, { forceEnglish: true });

    // 3. 통화를 USD로 설정 (페이지 접속 전 쿠키 설정)
    await setCurrencyToUSD(page);

    // 4. 첫 페이지 접속 (언어 파라미터 추가)
    console.log("🌍 아마존 검색 페이지 접속 중...");
    const finalUrl = (() => {
      const url = new URL(searchUrl);
      // 언어 파라미터 추가 (없는 경우에만)
      if (!url.searchParams.has('language')) {
        url.searchParams.set('language', 'en_US');
      }
      // 통화 파라미터 확인 및 추가
      if (!url.searchParams.has('currency')) {
        url.searchParams.set('currency', 'USD');
      }
      return url.toString();
    })();
    
    await page.goto(finalUrl, {
      waitUntil: "networkidle2",
      timeout,
    });
    console.log("✅ 페이지 접속 완료\n");
    
    // 추가 대기 시간 (동적 콘텐츠 로딩)
    if (verbose) {
      console.log("⏳ 페이지 로딩 대기 중... (5초)");
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 4. 페이지별로 상품 수집 (30개까지)
    while (allProducts.length < maxProducts) {
      pagesScraped++;
      console.log(`\n📄 === 페이지 ${pagesScraped} 수집 중 ===`);

      // 페이지 로딩 후 스크롤하여 lazy loading된 콘텐츠 로드
      if (pagesScraped === 1) {
        console.log("📜 페이지 스크롤하여 상품 로드 중...");
        // 점진적으로 스크롤 (lazy loading 트리거)
        await page.evaluate(async () => {
          const scrollStep = 500;
          const scrollDelay = 300;
          const maxScroll = document.body.scrollHeight;
          
          for (let position = 0; position < maxScroll; position += scrollStep) {
            window.scrollTo(0, position);
            await new Promise(resolve => setTimeout(resolve, scrollDelay));
          }
          
          // 다시 위로 스크롤 (상품 목록이 보이도록)
          window.scrollTo(0, 0);
          await new Promise(resolve => setTimeout(resolve, 1000));
        });
        console.log("✅ 스크롤 완료, 상품 로드 대기 중...");
        // 추가 대기 시간 (동적 콘텐츠 로딩)
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

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
      
      // 다음 페이지 로딩 대기
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
    console.log(`📄 수집한 페이지: ${result.pagesScraped}페이지`);
    console.log(`⏱️  소요 시간: ${(result.duration / 1000).toFixed(2)}초`);
    console.log("=".repeat(50) + "\n");

    return result;
  } catch (error) {
    console.error("❌ 스크래핑 실패:", error);
    throw error;
  } finally {
    // 브라우저 종료
    if (browser) {
      await browser.close();
    }
  }
}
