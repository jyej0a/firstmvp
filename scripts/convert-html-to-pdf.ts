/**
 * HTML 프레젠테이션을 개별 슬라이드 이미지로 변환하는 스크립트
 * 피그마 Import를 위해 사용 (각 슬라이드를 개별 이미지로)
 */

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

const HTML_FILE = path.join(__dirname, '../docs/presentation/presentation-final.html');
const OUTPUT_DIR = path.join(__dirname, '../docs/presentation/slides');

// 슬라이드 개수 (총 20개)
const TOTAL_SLIDES = 20;

async function convertHtmlToImages() {
  console.log('🔄 HTML을 개별 슬라이드 이미지로 변환 중...');
  console.log(`📄 입력 파일: ${HTML_FILE}`);
  console.log(`📁 출력 디렉토리: ${OUTPUT_DIR}\n`);

  // 출력 디렉토리 생성
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // 충분히 큰 viewport 설정 (슬라이드 전체가 보이도록)
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,  // 충분히 큰 너비
    height: 1200, // 슬라이드 높이(800px) + 여유 공간
    deviceScaleFactor: 2, // 고해상도 (2x)
  });

  try {
    // HTML 파일 로드
    const htmlPath = `file://${HTML_FILE}`;
    console.log(`📖 HTML 파일 로딩 중: ${htmlPath}`);
    await page.goto(htmlPath, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    // 페이지가 완전히 로드될 때까지 대기 (폰트 로딩 포함)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 각 슬라이드를 개별 이미지로 캡처
    console.log(`📸 ${TOTAL_SLIDES}개 슬라이드 캡처 중...\n`);

    for (let i = 0; i < TOTAL_SLIDES; i++) {
      // 슬라이드 요소 찾기
      const slideSelector = `.slide:nth-of-type(${i + 1})`;
      const slideElement = await page.$(slideSelector);

      if (slideElement) {
        // 해당 슬라이드로 스크롤 (요소가 viewport에 완전히 보이도록)
        await page.evaluate((slideIndex) => {
          const slides = document.querySelectorAll('.slide');
          if (slides[slideIndex]) {
            // 요소의 정확한 위치로 스크롤
            const rect = slides[slideIndex].getBoundingClientRect();
            window.scrollTo({
              top: rect.top + window.scrollY - 100, // 여유 공간
              left: 0,
              behavior: 'instant'
            });
          }
        }, i);

        // 스크롤 후 안정화 대기
        await new Promise(resolve => setTimeout(resolve, 800));

        // 슬라이드 요소 자체를 캡처 (요소의 정확한 크기로 자동 캡처)
        const screenshotPath = path.join(OUTPUT_DIR, `slide-${String(i + 1).padStart(2, '0')}.png`);
        await slideElement.screenshot({
          path: screenshotPath,
          type: 'png',
          // clip 옵션 제거 - 요소 자체의 크기를 사용
        });
        console.log(`✅ 슬라이드 ${i + 1}/${TOTAL_SLIDES} 저장: ${screenshotPath}`);
      } else {
        console.log(`⚠️  슬라이드 ${i + 1}를 찾을 수 없습니다.`);
      }
    }

    console.log(`\n✅ 모든 슬라이드 이미지 생성 완료!`);
    console.log(`📁 저장 위치: ${OUTPUT_DIR}`);
    console.log('\n📋 피그마 Import 방법:');
    console.log('1. 피그마(Figma) 열기');
    console.log('2. File → Import → Images 선택');
    console.log('3. slides 폴더의 모든 이미지 선택 (또는 드래그 앤 드롭)');
    console.log('4. 각 슬라이드가 프레임으로 자동 생성됩니다!');
    console.log('\n💡 팁: 모든 이미지를 한 번에 선택하려면 Cmd+A (Mac) 또는 Ctrl+A (Windows)');
  } catch (error) {
    console.error('❌ 이미지 변환 실패:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

convertHtmlToImages().catch(console.error);
