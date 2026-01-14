/**
 * Variants 추출 테스트 스크립트
 * 
 * 실제 아마존 상품 페이지에서 옵션(variants) 추출 로직을 테스트합니다.
 */

import puppeteer from 'puppeteer';

const TEST_URL = 'https://www.amazon.com/FREEORR-Lipstick-Hydrating-Lightweight-Finish-Set/dp/B0G6419DPJ/ref=sr_1_3?currency=USD&dib=eyJ2IjoiMSJ9.JwZC_NtnoLA3GSKoCa7RnpnniALypG7vGg9bxqO18b2962YYVkgN5OjPJA9QCyI7SXnxQ0Gs9RRX1CetCTDBhm-ZBs9ysUhdpcAIoZJy13nqvUix0EutCu7rZLUx9CLWME5cZBSvaJ-3Sq0WYMMCvX2GUxBJpU0gLYgr-G-WmG4SIc-hMzDbNXnobOsqGxD6GbLwT40w0JO8QzO9uM8hLxj5_7ZwFKgfQw0Prrgj8Jmi4sGxzoAc2847ntgY56IiNOJVna7I3-2AYC04d91A0m_-0mkTjbgdqnUcN7hDY6I.xE5UukYPTIU0Pa2jCUlA9yp5WDdacOhuA_wpGxj7g58&dib_tag=se&keywords=lipstick&qid=1767686572&sr=8-3&th=1';

async function testVariantsExtraction() {
  console.log('🧪 Variants 추출 테스트 시작\n');
  console.log(`📍 테스트 URL: ${TEST_URL}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
  });

  const page = await browser.newPage();

  try {
    // 0. 미국 아마존 강제 유지 설정
    console.log('0️⃣ 미국 아마존 강제 유지 설정 중...');
    
    // 0-1. 쿠키 설정 (언어/지역 고정)
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
    
    // 0-2. 헤더 설정
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    
    console.log('✅ 미국 아마존 설정 완료\n');

    // 1. 페이지 이동
    console.log('1️⃣ 페이지 로딩 중...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle2' });
    console.log('✅ 페이지 로딩 완료\n');

    // 1-1. 초기 스크린샷
    await page.screenshot({ path: '/tmp/variants-test-initial.png', fullPage: true });
    console.log('📸 초기 스크린샷 저장: /tmp/variants-test-initial.png\n');

    // 1-2. Bot Detection 페이지 처리
    console.log('🔍 Bot Detection 체크 중...');
    
    // 여러 셀렉터 시도
    const buttonSelectors = [
      'button:has-text("Continue shopping")',
      'input[type="submit"]',
      'a:has-text("Continue shopping")',
      'button',
      'input[value*="Continue"]',
    ];
    
    let continueButton = null;
    for (const selector of buttonSelectors) {
      try {
        continueButton = await page.$(selector);
        if (continueButton) {
          console.log(`  ✅ 버튼 발견 (셀렉터: ${selector})`);
          break;
        }
      } catch (e) {
        // 일부 셀렉터는 지원하지 않을 수 있음 (예: :has-text)
        continue;
      }
    }
    
    if (continueButton) {
      console.log('🤖 Bot Detection 감지! 버튼 클릭 중...');
      await continueButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('✅ Bot Detection 우회 완료\n');
      
      // Bot Detection 우회 후 스크린샷
      await page.screenshot({ path: '/tmp/variants-test-after-bot-check.png', fullPage: true });
      console.log('📸 Bot Detection 우회 후 스크린샷: /tmp/variants-test-after-bot-check.png\n');
    } else {
      console.log('  ❌ Bot Detection 버튼을 찾을 수 없음\n');
      console.log('  💡 수동으로 우회를 시도하거나, User-Agent를 개선해야 할 수 있습니다.\n');
    }

    // 1-3. 페이지 중앙으로 스크롤 (lazy loading 대응)
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('📜 페이지 스크롤 완료\n');

    // 1-4. 스크롤 후 스크린샷
    await page.screenshot({ path: '/tmp/variants-test-scrolled.png', fullPage: true });
    console.log('📸 스크롤 후 스크린샷 저장: /tmp/variants-test-scrolled.png\n');

    // 2. 기존 셀렉터 테스트
    console.log('2️⃣ 기존 셀렉터 테스트:');
    const oldSelectors = [
      '#variation_color_name',
      '#variation_color_name ul li',
      '[data-attribute-name="color_name"]',
      '.a-button-selected[data-attribute-name="color_name"]',
    ];

    for (const selector of oldSelectors) {
      const count = await page.evaluate((sel) => {
        return document.querySelectorAll(sel).length;
      }, selector);
      console.log(`  ${selector}: ${count}개 발견`);
    }
    console.log('');

    // 3. Radio button 셀렉터 테스트
    console.log('3️⃣ Radio Button 셀렉터 테스트:');
    const radioSelectors = [
      'input[type="radio"]',
      'input[type="radio"][name*="color"]',
      'input[type="radio"][name*="Color"]',
    ];

    for (const selector of radioSelectors) {
      const count = await page.evaluate((sel) => {
        return document.querySelectorAll(sel).length;
      }, selector);
      console.log(`  ${selector}: ${count}개 발견`);
    }
    console.log('');

    // 4. 실제 radio button 정보 추출
    console.log('4️⃣ Radio Button 상세 정보:');
    const radioInfo = await page.evaluate(() => {
      const radioInputs = document.querySelectorAll('input[type="radio"]');
      const results: Array<{
        name: string;
        value: string;
        checked: boolean;
        id: string;
        labelText: string;
      }> = [];

      radioInputs.forEach((radio) => {
        const input = radio as HTMLInputElement;
        const name = input.getAttribute('name') || '';
        const value = input.getAttribute('value') || '';
        const checked = input.checked;
        const id = input.id;

        // Label 찾기
        let labelText = '';
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) {
          labelText = label.textContent?.trim() || '';
        } else {
          // 부모에서 라벨 찾기
          const parent = input.closest('div, span, li');
          if (parent) {
            labelText = parent.textContent?.trim().substring(0, 50) || '';
          }
        }

        // Color 관련 항목만 수집
        if (
          name.toLowerCase().includes('color') ||
          labelText.toLowerCase().includes('set') ||
          labelText.toLowerCase().includes('color')
        ) {
          results.push({ name, value, checked, id, labelText });
        }
      });

      return results;
    });

    if (radioInfo.length > 0) {
      radioInfo.forEach((info, idx) => {
        console.log(`  [${idx}] 🎯 옵션 발견:`);
        console.log(`    - name: "${info.name}"`);
        console.log(`    - value: "${info.value}"`);
        console.log(`    - checked: ${info.checked}`);
        console.log(`    - id: "${info.id}"`);
        console.log(`    - labelText: "${info.labelText}"`);
        console.log('');
      });
    } else {
      console.log('  ❌ Radio button 옵션을 찾지 못했습니다.\n');
    }

    // 5. 선택된 옵션 추출
    console.log('5️⃣ 선택된 옵션 추출 (현재 구현과 동일):');
    const selectedVariants = await page.evaluate(() => {
      const variantList: string[] = [];

      // 방법 1: 색상 옵션 (기존 셀렉터)
      const colorSelectors = [
        '#variation_color_name',
        '#variation_color_name ul li',
        '[data-attribute-name="color_name"]',
        '.a-button-selected[data-attribute-name="color_name"]',
      ];

      for (const selector of colorSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const selectedColor = element.getAttribute('title') || element.textContent?.trim();
          if (selectedColor) {
            variantList.push(`Color: ${selectedColor}`);
            break;
          }
        }
      }

      return variantList.length > 0 ? variantList : null;
    });

    if (selectedVariants) {
      console.log(`  ✅ 추출 성공: ${selectedVariants.join(', ')}`);
    } else {
      console.log('  ❌ 추출 실패 (기존 셀렉터로는 찾을 수 없음)');
    }
    console.log('');

    // 6. 새로운 방법으로 추출 시도
    console.log('6️⃣ 새로운 방법 (Radio Button 기반) 테스트:');
    const newVariants = await page.evaluate(() => {
      const variantList: string[] = [];

      // Radio button으로 선택된 옵션 찾기
      const selectedRadios = document.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked');

      selectedRadios.forEach((radio) => {
        const name = radio.getAttribute('name') || '';
        const value = radio.getAttribute('value') || '';
        const id = radio.id;

        // 옵션 이름 추출 (name에서 또는 상위 요소에서)
        let optionName = 'Option';
        if (name.toLowerCase().includes('color')) {
          optionName = 'Color';
        } else if (name.toLowerCase().includes('size')) {
          optionName = 'Size';
        }

        // Label에서 값 추출
        let optionValue = value;
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) {
          optionValue = label.textContent?.trim() || value;
        }

        if (optionValue && optionValue !== '') {
          variantList.push(`${optionName}: ${optionValue}`);
        }
      });

      return variantList.length > 0 ? variantList : null;
    });

    if (newVariants) {
      console.log(`  ✅ 추출 성공: ${newVariants.join(', ')}`);
    } else {
      console.log('  ❌ 추출 실패');
    }
    console.log('');

    // 7. 현재 URL 확인
    const currentUrl = page.url();
    console.log(`7️⃣ 현재 URL: ${currentUrl}\n`);

    // 8. 페이지 HTML 일부 저장 (옵션 관련 부분만)
    console.log('8️⃣ 옵션 관련 HTML 구조 추출 중...');
    const optionsHtml = await page.evaluate(() => {
      // 옵션과 관련된 키워드로 요소 찾기
      const keywords = ['color', 'Color', '색상', 'variant', 'variation', 'twister', 'option'];
      const foundElements: string[] = [];

      keywords.forEach(keyword => {
        // ID로 찾기
        const byId = document.querySelectorAll(`[id*="${keyword}"]`);
        byId.forEach(el => {
          const html = el.outerHTML.substring(0, 200);
          if (!foundElements.includes(html)) {
            foundElements.push(`\n[ID contains "${keyword}"]\n${html}...\n`);
          }
        });

        // Class로 찾기
        const byClass = document.querySelectorAll(`[class*="${keyword}"]`);
        if (byClass.length > 0 && byClass.length < 5) {
          byClass.forEach(el => {
            const html = el.outerHTML.substring(0, 200);
            if (!foundElements.includes(html)) {
              foundElements.push(`\n[Class contains "${keyword}"]\n${html}...\n`);
            }
          });
        }
      });

      return foundElements.length > 0 
        ? foundElements.slice(0, 10).join('\n---\n') 
        : '❌ 옵션 관련 요소를 찾을 수 없습니다.';
    });

    console.log(optionsHtml);
    console.log('\n');

  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  } finally {
    await browser.close();
    console.log('\n✅ 테스트 완료');
  }
}

// 테스트 실행
testVariantsExtraction().catch(console.error);
