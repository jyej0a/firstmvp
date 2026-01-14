/**
 * 새로운 Variants 셀렉터 테스트
 * 
 * 발견한 셀렉터들을 실제로 테스트합니다.
 */

import puppeteer from 'puppeteer';

const TEST_URL = 'https://www.amazon.com/FREEORR-Lipstick-Hydrating-Lightweight-Finish-Set/dp/B0G6419DPJ/ref=sr_1_3?currency=USD&dib=eyJ2IjoiMSJ9.JwZC_NtnoLA3GSKoCa7RnpnniALypG7vGg9bxqO18b2962YYVkgN5OjPJA9QCyI7SXnxQ0Gs9RRX1CetCTDBhm-ZBs9ysUhdpcAIoZJy13nqvUix0EutCu7rZLUx9CLWME5cZBSvaJ-3Sq0WYMMCvX2GUxBJpU0gLYgr-G-WmG4SIc-hMzDbNXnobOsqGxD6GbLwT40w0JO8QzO9uM8hLxj5_7ZwFKgfQw0Prrgj8Jmi4sGxzoAc2847ntgY56IiNOJVna7I3-2AYC04d91A0m_-0mkTjbgdqnUcN7hDY6I.xE5UukYPTIU0Pa2jCUlA9yp5WDdacOhuA_wpGxj7g58&dib_tag=se&keywords=lipstick&qid=1767686572&sr=8-3&th=1';

async function testNewSelectors() {
  console.log('🧪 새로운 Variants 셀렉터 테스트\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
  });

  const page = await browser.newPage();

  try {
    // 미국 아마존 강제 유지 설정
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

    // 페이지 로딩
    console.log('📍 페이지 로딩 중...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle2' });

    // Bot Detection 우회
    const continueButton = await page.$('button');
    if (continueButton) {
      console.log('🤖 Bot Detection 우회 중...');
      await continueButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('✅ 페이지 로딩 완료\n');

    // 테스트할 새로운 셀렉터들
    const newSelectors = [
      {
        name: 'inline-twister (color)',
        selector: '#inline-twister-expanded-dimension-text-color_name',
        description: '선택된 색상 텍스트',
      },
      {
        name: 'inline-twister (size)',
        selector: '#inline-twister-expanded-dimension-text-size_name',
        description: '선택된 크기 텍스트',
      },
      {
        name: 'twister row (color)',
        selector: '#inline-twister-row-color_name',
        description: '색상 옵션 전체 row',
      },
      {
        name: 'selected button (color)',
        selector: '.a-button-selected[id*="color_name"]',
        description: '선택된 색상 버튼',
      },
      {
        name: 'all dimension texts',
        selector: '[id^="inline-twister-expanded-dimension-text-"]',
        description: '모든 선택된 옵션 텍스트',
      },
    ];

    console.log('🔍 새로운 셀렉터 테스트:\n');

    for (const { name, selector, description } of newSelectors) {
      const result = await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        if (elements.length === 0) return null;

        return Array.from(elements).map(el => ({
          text: el.textContent?.trim() || '',
          id: el.id,
          className: el.className,
        }));
      }, selector);

      if (result && result.length > 0) {
        console.log(`✅ ${name}`);
        console.log(`   셀렉터: ${selector}`);
        console.log(`   설명: ${description}`);
        console.log(`   발견: ${result.length}개`);
        result.forEach((item, idx) => {
          console.log(`   [${idx}] text: "${item.text}", id: "${item.id}"`);
        });
        console.log('');
      } else {
        console.log(`❌ ${name}: 0개 발견`);
        console.log(`   셀렉터: ${selector}\n`);
      }
    }

    // 통합 테스트: 실제 variants 추출 로직
    console.log('🎯 통합 테스트: Variants 추출\n');

    const variants = await page.evaluate(() => {
      const variantList: string[] = [];

      // 방법 1: inline-twister 셀렉터 (새로운 방법)
      const dimensionTexts = document.querySelectorAll('[id^="inline-twister-expanded-dimension-text-"]');
      dimensionTexts.forEach((el) => {
        const id = el.id;
        const text = el.textContent?.trim();
        
        if (!text || text === '') return;

        // ID에서 옵션 타입 추출 (예: color_name, size_name)
        const match = id.match(/inline-twister-expanded-dimension-text-(.+)/);
        if (match) {
          const dimensionType = match[1]; // 예: "color_name"
          
          // 옵션 이름 정리 (color_name -> Color)
          let optionName = dimensionType.replace(/_name$/, '').replace(/_/g, ' ');
          optionName = optionName.charAt(0).toUpperCase() + optionName.slice(1);
          
          variantList.push(`${optionName}: ${text}`);
        }
      });

      return variantList.length > 0 ? variantList : null;
    });

    if (variants) {
      console.log('✅ Variants 추출 성공!');
      variants.forEach((v, idx) => {
        console.log(`   [${idx}] ${v}`);
      });
    } else {
      console.log('❌ Variants 추출 실패');
    }

  } catch (error) {
    console.error('❌ 테스트 중 오류:', error);
  } finally {
    await browser.close();
    console.log('\n✅ 테스트 완료');
  }
}

testNewSelectors().catch(console.error);


