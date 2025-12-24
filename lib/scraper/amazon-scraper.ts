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
      return { products: [], debugInfo, usedSelector: "" };
    }
    
    if (verboseMode) {
      console.log(`📊 ${usedSelector}로 ${productElements.length}개 요소 발견, 상품 정보 추출 시작...`);
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

        // 이미지 추출 (검색 결과 페이지에서 가능한 모든 이미지 수집)
        const images: string[] = [];
        const seenUrls = new Set<string>(); // 중복 체크용

        // 1. 메인 썸네일 이미지
        const mainImage = element.querySelector("img.s-image");
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
        const hasDollarSymbol = priceText.includes("$");
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

        // 유효성 검증 (최소 필수 조건만 체크 - null 반환 방지)
        // 필수: ASIN, 제목, URL
        // 선택: 이미지, 가격 (없어도 허용, 나중에 수정 가능)
        if (asin && title && sourceUrl) {
          // 이미지가 없으면 빈 배열로 설정 (상세 페이지에서 수집 가능)
          const finalImages = images.length > 0 ? images : [];
          
          // 가격이 0이거나 없으면 기본값 설정 (나중에 수정 가능)
          const finalPrice = amazonPrice > 0 ? amazonPrice : 0.01;
          
          scrapedProducts.push({
            asin,
            title,
            images: finalImages,
            amazonPrice: finalPrice,
            sourceUrl,
          });

          if (verboseMode && index < 3) {
            console.log(`  ${index + 1}. ${title} (${asin}) - $${finalPrice.toFixed(2)}`);
            if (images.length === 0) {
              console.warn(`     ⚠️  이미지 없음 (상세 페이지에서 수집 시도 예정)`);
            }
            if (amazonPrice <= 0) {
              console.warn(`     ⚠️  가격 없음 (기본값 $0.01 설정, 나중에 수정 필요)`);
            }
          }
        } else {
          // 디버깅: 왜 상품이 제외되었는지 로그 (ASIN, 제목, URL이 없는 경우만)
          if (verboseMode) {
            const reasons = [];
            if (!asin) reasons.push("ASIN 없음");
            if (!title) reasons.push("제목 없음");
            if (!sourceUrl) reasons.push("URL 없음");
            
            if (reasons.length > 0 && index < 5) {
              console.warn(`  ⚠️  상품 ${index + 1} 건너뜀: ${reasons.join(", ")} (필수 조건 미충족)`);
            }
          }
        }
      } catch (error) {
        console.error("상품 추출 중 에러:", error);
      }
    });

    return { products: scrapedProducts, debugInfo, usedSelector };
  }, selectors, verbose);

  // Node.js 콘솔에 디버깅 정보 출력
  if (verbose) {
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

    // 상세 페이지에서 추가 이미지 수집
    if (product.sourceUrl) {
      const detailImages = await extractImagesFromDetailPage(page, product.sourceUrl);

      // 중복 제거 유틸리티 사용
      const { deduplicateImages } = await import("@/lib/utils/image-deduplicator");
      const allImages = deduplicateImages([...product.images, ...detailImages]);

      // 상세 페이지 이미지와 병합
      product.images = allImages;
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

    // 2. 페이지 생성 및 설정 (V1: 영어 강제 설정)
    const page = await initPage(browser, timeout, { forceEnglish: options.forceEnglish });

    // 3. 첫 페이지 접속 (언어 파라미터 추가 - V1 전용)
    console.log("🌍 아마존 검색 페이지 접속 중...");
    const finalUrl = options.forceEnglish 
      ? (() => {
          const url = new URL(searchUrl);
          // 언어 파라미터 추가 (없는 경우에만)
          if (!url.searchParams.has('language')) {
            url.searchParams.set('language', 'en_US');
          }
          return url.toString();
        })()
      : searchUrl;
    
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
