/**
 * 프레젠테이션 전체를 PDF 변환용 단일 HTML 파일로 생성하는 스크립트
 * 
 * 사용 방법:
 * 1. 이 스크립트 실행: pnpm tsx scripts/generate-pdf-html.ts
 * 2. 생성된 HTML 파일 열기: docs/presentation/presentation-for-pdf.html
 * 3. 브라우저에서 Cmd+P (Mac) 또는 Ctrl+P (Windows)로 인쇄
 * 4. "PDF로 저장" 선택
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_FILE = path.join(__dirname, '../docs/presentation/presentation-for-pdf.html');

// 표지 슬라이드 HTML
const coverSlide = `
    <!-- SLIDE 00: 표지 -->
    <div class="slide" style="margin-top: 0;">
        <div class="padding-box center" style="position: relative; padding-top: 100px;">
            <p style="color: var(--neon-pink); font-size: 24px; letter-spacing: 2px;">★ FINAL REPORT ★</p>
            <h1>TREND-HYBRID<br/>ADMIN</h1>
            <div class="pixel-box" style="margin-top: 40px; display: inline-block; padding: 20px 60px;">
                <p style="margin: 0; font-size: 24px; color: var(--neon-yellow);">트렌드 헌팅 자동화 솔루션</p>
            </div>
            <div style="margin-top: 60px; font-size: 20px;">
                <p>AI 리더 프로젝트 결과 보고서</p>
                <p style="color: #aaa; margin-top: 20px;">2026년 1월 | TEAM: 1인 프로젝트 (PM: 문지영)</p>
            </div>
            <a 
                href="https://www.youtube.com/watch?v=OrNZ46IpNBc" 
                target="_blank" 
                rel="noopener noreferrer"
                style="
                    position: absolute;
                    bottom: 40px;
                    right: 40px;
                    font-size: 16px;
                    color: var(--neon-cyan);
                    text-decoration: none;
                    border-bottom: 1px dashed var(--neon-cyan);
                    padding-bottom: 2px;
                "
            >
                시연 영상 보기 →
            </a>
        </div>
    </div>
`;

// 목차 슬라이드 HTML
const tocSlide = `
    <!-- SLIDE 01: 목차 -->
    <div class="slide">
        <div class="padding-box">
            <div class="status-bar"><span>STAGE 0</span><span>CONTENTS</span></div>
            <h2>목차</h2>
            <div class="flex-col" style="justify-content: center; gap: 30px;">
                <div class="pixel-box" style="border-color: var(--neon-lime);">
                    <h3 style="color: var(--neon-lime);">1. 프로젝트 개요</h3>
                </div>
                <div class="pixel-box" style="border-color: var(--neon-cyan);">
                    <h3 style="color: var(--neon-cyan);">2. 프로젝트 팀 구성 및 역할</h3>
                </div>
                <div class="pixel-box" style="border-color: var(--neon-yellow);">
                    <h3 style="color: var(--neon-yellow);">3. 프로젝트 수행 절차 및 방법</h3>
                </div>
                <div class="pixel-box" style="border-color: var(--neon-pink);">
                    <h3 style="color: var(--neon-pink);">4. 프로젝트 수행 경과</h3>
                </div>
                <div class="pixel-box" style="border-color: var(--neon-purple);">
                    <h3 style="color: var(--neon-purple);">5. 자체 평가 의견</h3>
                </div>
            </div>
        </div>
    </div>
`;

async function generatePdfHtml() {
  console.log('📄 PDF 변환용 HTML 파일 생성 중...\n');

  // presentation-final.html 파일 읽기
  const htmlFilePath = path.join(__dirname, '../public/docs/presentation/presentation-final.html');
  const htmlContent = await fs.promises.readFile(htmlFilePath, 'utf-8');

  // body 태그 내용만 추출
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : htmlContent;

  // 전체 HTML 생성
  const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trend-Hybrid Admin: Final Report</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        @font-face {
            font-family: 'DungGeunMo';
            src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/DungGeunMo.woff') format('woff');
            font-weight: normal;
            font-style: normal;
        }
        :root {
            --bg-color: #0d0e15;
            --neon-lime: #39ff14;
            --neon-pink: #ff00ff;
            --neon-cyan: #00ffff;
            --neon-yellow: #fff01f;
            --neon-purple: #9d4edd;
            --text-main: #ffffff;
            --border-width: 4px;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 80px 40px;
            background-color: #000;
            color: var(--text-main);
            font-family: 'DungGeunMo', monospace;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 60px;
            width: 100%;
            overflow-x: auto;
        }
        .slide {
            width: 1280px;
            min-height: 800px;
            height: auto;
            background-color: var(--bg-color);
            position: relative;
            overflow: visible;
            display: flex;
            flex-direction: column;
            border: var(--border-width) solid var(--text-main);
            box-shadow: 0 0 20px rgba(57, 255, 20, 0.3), inset 0 0 60px rgba(0,0,0,0.7);
            flex-shrink: 0;
            margin-bottom: 60px;
        }
        .slide:last-child {
            margin-bottom: 80px;
        }
        .slide::after {
            content: " ";
            display: block;
            position: absolute;
            top: 0; left: 0; bottom: 0; right: 0;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
            z-index: 10;
            background-size: 100% 2px, 3px 100%;
            pointer-events: none;
        }
        h1 { font-size: 72px; margin: 0; text-shadow: 4px 4px 0px #000, 0 0 10px var(--neon-lime); color: var(--neon-lime); line-height: 1.2; }
        h2 { font-size: 42px; margin: 0 0 30px 0; color: var(--neon-cyan); text-shadow: 2px 2px 0px #000; border-bottom: 4px dashed var(--neon-cyan); padding-bottom: 10px; display: inline-block;}
        h3 { font-size: 28px; margin: 0 0 15px 0; color: var(--neon-yellow); }
        h4 { font-size: 22px; margin: 0 0 10px 0; color: var(--neon-lime); }
        p, li { font-size: 20px; line-height: 1.6; margin-bottom: 10px; color: #ddd; }
        strong { color: #fff; text-decoration: underline; text-decoration-color: var(--neon-pink); }
        .padding-box { padding: 40px; min-height: calc(100% - 80px); display: flex; flex-direction: column; position: relative; z-index: 5; }
        .flex-row { display: flex; gap: 40px; min-height: auto; flex-wrap: nowrap; }
        .flex-col { display: flex; flex-direction: column; min-height: auto; justify-content: center; }
        .center { align-items: center; justify-content: center; text-align: center; }
        .w-50 { width: 50%; } .w-40 { width: 40%; } .w-60 { width: 60%; } .w-33 { width: 33%; }
        .pixel-box {
            border: 4px solid #fff;
            background: rgba(0,0,0,0.5);
            padding: 20px;
            box-shadow: 8px 8px 0px rgba(255,255,255,0.2);
        }
        .status-bar {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-size: 20px;
            color: #888;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
        }
        .img-area {
            width: 100%; height: 100%;
            background: #222;
            border: 2px dashed var(--neon-pink);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            color: var(--neon-pink);
            text-align: center;
        }
        .img-area i { font-size: 40px; margin-bottom: 10px; }
        .stat-row { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; }
        .stat-label { width: 150px; font-size: 20px; color: var(--neon-cyan); }
        .stat-bar-bg { flex-grow: 1; height: 20px; background: #333; border: 2px solid #fff; }
        .stat-bar-fill { height: 100%; background: var(--neon-lime); }
        .table-box { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 16px; }
        .table-box th, .table-box td {
            border: 2px solid #fff;
            padding: 10px;
            text-align: left;
        }
        .table-box th {
            background: rgba(57, 255, 20, 0.2);
            color: var(--neon-lime);
        }
        .table-box td { color: #ddd; }
        .code-block {
            background: #000;
            border: 2px solid var(--neon-cyan);
            padding: 15px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: var(--neon-lime);
            overflow-x: auto;
            margin: 15px 0;
            white-space: pre;
        }
        ul { list-style: none; padding-left: 0; }
        ul li::before { content: "▶ "; color: var(--neon-lime); margin-right: 10px; }
        ul li { margin-bottom: 8px; }
        .check-mark { color: var(--neon-lime); margin-right: 8px; }
        .warn-mark { color: var(--neon-yellow); margin-right: 8px; }
        
        /* PDF 인쇄용 스타일 */
        @media print {
            body {
                padding: 0;
                background: #000;
            }
            .slide {
                page-break-after: always;
                page-break-inside: avoid;
                margin-bottom: 0;
            }
            .slide:last-child {
                page-break-after: auto;
            }
        }
    </style>
</head>
<body>
${coverSlide}
${tocSlide}
${bodyContent}
</body>
</html>`;

  // 출력 디렉토리 확인 및 생성
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 파일 저장
  await fs.promises.writeFile(OUTPUT_FILE, fullHtml, 'utf-8');

  console.log('✅ PDF 변환용 HTML 파일 생성 완료!');
  console.log(`📄 파일 위치: ${OUTPUT_FILE}\n`);
  console.log('📋 PDF 변환 방법:');
  console.log('1. 생성된 HTML 파일을 브라우저에서 열기');
  console.log('2. Cmd+P (Mac) 또는 Ctrl+P (Windows)로 인쇄 대화상자 열기');
  console.log('3. "PDF로 저장" 또는 "Save as PDF" 선택');
  console.log('4. 저장 위치와 파일명 지정 후 저장\n');
  console.log('💡 팁: 인쇄 설정에서 "배경 그래픽" 옵션을 활성화하면 배경색과 그림자가 제대로 표시됩니다.');
}

generatePdfHtml().catch(console.error);
