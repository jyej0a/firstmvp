/**
 * Variants 직접 테스트
 * 
 * 상품 페이지로 직접 이동하여 variants를 추출합니다.
 */

import puppeteer from 'puppeteer';

// FREEORR 립스틱 직접 URL (명확한 variants 있는 상품)
const PRODUCT_URL = 'https://www.amazon.com/FREEORR-Lipstick-Hydrating-Lightweight-Finish-Set/dp/B0G6419DPJ';

async function testVariantsDirectly() {
  console.log('🧪 Variants 직접 추출 테스트\n');
  console.log('📍 상품 URL:', PRODUCT_URL);
  console.log('📍 예상 옵션: "Color: Set A" 또는 "Color: Set B"\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
  });

  const page = await browser.newPage();

  try {
    // 미국 아마존 강제 유지
    console.log('🇺🇸 미국 아마존 설정 중...');
    await page.setCookie(
      {
        name: 'lc-main',
        value: 'en_US',
        domain: '.amazon.com',
        path: '/',
      },
      {
        name: 'i18n-prefs',
        value: 'USD',
        domain: '.amazon.com',
        path: '/',
      }
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 페이지 로딩
    console.log('📄 페이지 로딩 중...');
    await page.goto(PRODUCT_URL, { waitUntil: 'networkidle2' });

    // Bot Detection 우회
    try {
      const continueButton = await page.$('button');
      if (continueButton) {
        console.log('🤖 Bot Detection 우회 시도...');
        await continueButton.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('✅ Bot Detection 우회 완료');
      }
    } catch (e) {
      console.log('⚠️  Bot Detection 버튼 클릭 실패 (페이지가 이미 정상일 수 있음)');
    }

    console.log('✅ 페이지 로딩 완료\n');

    // 현재 URL 확인
    const currentUrl = page.url();
    console.log(`🌐 현재 URL: ${currentUrl}\n`);

    // Variants 추출 (수정된 로직 사용)
    console.log('🎯 Variants 추출 시작...\n');

    const variants = await page.evaluate(() => {
      const variantList: string[] = [];

      console.log('=== Variants 추출 로직 실행 ===');

      // 방법 1: inline-twister 셀렉터 (최신 아마존 구조)
      console.log('\n1️⃣ inline-twister 셀렉터 시도...');
      const dimensionTexts = document.querySelectorAll('[id^="inline-twister-expanded-dimension-text-"]');
      console.log(`  - 발견된 요소 개수: ${dimensionTexts.length}`);
      
      dimensionTexts.forEach((el, idx) => {
        const id = el.id;
        const text = el.textContent?.trim();
        console.log(`  - [${idx}] id="${id}", text="${text}"`);
        
        if (!text || text === '') return;

        const match = id.match(/inline-twister-expanded-dimension-text-(.+)/);
        if (match) {
          const dimensionType = match[1];
          let optionName = dimensionType.replace(/_name$/, '').replace(/_/g, ' ');
          optionName = optionName.charAt(0).toUpperCase() + optionName.slice(1);
          
          const variant = `${optionName}: ${text}`;
          console.log(`  ✅ 추가: "${variant}"`);
          variantList.push(variant);
        }
      });

      if (variantList.length > 0) {
        console.log(`\n✅ inline-twister로 ${variantList.length}개 발견!`);
        return variantList;
      }

      // 방법 2: 레거시 variation 셀렉터
      console.log('\n2️⃣ 레거시 variation 셀렉터 시도...');

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
          console.log(`  - ${selector}: "${selectedColor}"`);
          if (selectedColor) {
            variantList.push(`Color: ${selectedColor}`);
            break;
          }
        }
      }

      if (variantList.length > 0) {
        console.log(`\n✅ 레거시 셀렉터로 ${variantList.length}개 발견!`);
      } else {
        console.log(`\n❌ variants를 찾을 수 없습니다`);
      }

      return variantList.length > 0 ? variantList : null;
    });

    console.log('\n' + '='.repeat(60));
    if (variants) {
      console.log('✅ ✅ ✅ Variants 추출 성공! ✅ ✅ ✅');
      console.log('='.repeat(60));
      variants.forEach((v, idx) => {
        console.log(`  [${idx}] ${v}`);
      });
    } else {
      console.log('❌ ❌ ❌ Variants 추출 실패 ❌ ❌ ❌');
      console.log('='.repeat(60));
    }

    // 스크린샷 저장
    await page.screenshot({ path: '/tmp/variants-direct-test.png', fullPage: true });
    console.log('\n📸 스크린샷 저장: /tmp/variants-direct-test.png');

  } catch (error) {
    console.error('\n❌ 테스트 중 오류:', error);
  } finally {
    await browser.close();
    console.log('\n✅ 테스트 완료');
  }
}

testVariantsDirectly();

