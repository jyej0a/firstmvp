/**
 * @file app/dashboard-v2/presentation/page.tsx
 * @description AI리더 프로젝트 결과보고서 프레젠테이션
 * 
 * presentation-final.html의 모든 슬라이드를 한 페이지에 표시
 * - 레트로 게임 스타일 디자인
 * - 21개 슬라이드 (표지, 목차, 본문 19개)
 * - 세로 스크롤로 모든 슬라이드 확인 가능
 */

'use client';

import { useEffect, useState } from 'react';

export default function PresentationPage() {
  const [htmlContent, setHtmlContent] = useState<string>('');

  useEffect(() => {
    // Font Awesome 로드
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);

    // HTML 파일 내용 로드
    fetch('/api/presentation')
      .then(res => res.json())
      .then(data => {
        if (data.content) {
          setHtmlContent(data.content);
        }
      })
      .catch(err => console.error('Failed to load presentation:', err));

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div className="presentation-container">
      <style jsx global>{`
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
        .presentation-container {
          margin: 0;
          padding: 80px 40px;
          background-color: #000;
          color: var(--text-main);
          font-family: 'DungGeunMo', monospace;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 60px;
          min-height: 100vh;
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
        }
        .presentation-container .slide {
          margin-bottom: 60px;
        }
        .presentation-container .slide:last-child {
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
        .slide h1 { font-size: 72px; margin: 0; text-shadow: 4px 4px 0px #000, 0 0 10px var(--neon-lime); color: var(--neon-lime); line-height: 1.2; }
        .slide h2 { font-size: 42px; margin: 0 0 30px 0; color: var(--neon-cyan); text-shadow: 2px 2px 0px #000; border-bottom: 4px dashed var(--neon-cyan); padding-bottom: 10px; display: inline-block;}
        .slide h3 { font-size: 28px; margin: 0 0 15px 0; color: var(--neon-yellow); }
        .slide h4 { font-size: 22px; margin: 0 0 10px 0; color: var(--neon-lime); }
        .slide p, .slide li { font-size: 20px; line-height: 1.6; margin-bottom: 10px; color: #ddd; }
        .slide strong { color: #fff; text-decoration: underline; text-decoration-color: var(--neon-pink); }
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
        .slide ul { list-style: none; padding-left: 0; }
        .slide ul li::before { content: "▶ "; color: var(--neon-lime); margin-right: 10px; }
        .slide ul li { margin-bottom: 8px; }
        .check-mark { color: var(--neon-lime); margin-right: 8px; }
        .warn-mark { color: var(--neon-yellow); margin-right: 8px; }
      `}</style>

      {/* SLIDE 00: 표지 */}
      <div className="slide" style={{marginTop: '0'}}>
        <div className="padding-box center" style={{position: 'relative', paddingTop: '100px'}}>
          <p style={{color: 'var(--neon-pink)', fontSize: '24px', letterSpacing: '2px'}}>★ FINAL REPORT ★</p>
          <h1>TREND-HYBRID<br/>ADMIN</h1>
          <div className="pixel-box" style={{marginTop: '40px', display: 'inline-block', padding: '20px 60px'}}>
            <p style={{margin: 0, fontSize: '24px', color: 'var(--neon-yellow)'}}>트렌드 헌팅 자동화 솔루션</p>
          </div>
          <div style={{marginTop: '60px', fontSize: '20px'}}>
            <p>AI 리더 프로젝트 결과 보고서</p>
            <p style={{color: '#aaa', marginTop: '20px'}}>2026년 1월 | TEAM: 1인 프로젝트 (PM: 문지영)</p>
          </div>
          <a 
            href="https://www.youtube.com/watch?v=OrNZ46IpNBc" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              position: 'absolute',
              bottom: '40px',
              right: '40px',
              fontSize: '16px',
              color: 'var(--neon-cyan)',
              textDecoration: 'none',
              borderBottom: '1px dashed var(--neon-cyan)',
              paddingBottom: '2px'
            }}
          >
            시연 영상 보기 →
          </a>
        </div>
      </div>

      {/* SLIDE 01: 목차 */}
      <div className="slide">
        <div className="padding-box">
          <div className="status-bar"><span>STAGE 0</span><span>CONTENTS</span></div>
          <h2>목차</h2>
          <div className="flex-col" style={{justifyContent: 'center', gap: '30px'}}>
            <div className="pixel-box" style={{borderColor: 'var(--neon-lime)'}}>
              <h3 style={{color: 'var(--neon-lime)'}}>1. 프로젝트 개요</h3>
            </div>
            <div className="pixel-box" style={{borderColor: 'var(--neon-cyan)'}}>
              <h3 style={{color: 'var(--neon-cyan)'}}>2. 프로젝트 팀 구성 및 역할</h3>
            </div>
            <div className="pixel-box" style={{borderColor: 'var(--neon-yellow)'}}>
              <h3 style={{color: 'var(--neon-yellow)'}}>3. 프로젝트 수행 절차 및 방법</h3>
            </div>
            <div className="pixel-box" style={{borderColor: 'var(--neon-pink)'}}>
              <h3 style={{color: 'var(--neon-pink)'}}>4. 프로젝트 수행 경과</h3>
            </div>
            <div className="pixel-box" style={{borderColor: 'var(--neon-purple)'}}>
              <h3 style={{color: 'var(--neon-purple)'}}>5. 자체 평가 의견</h3>
            </div>
          </div>
        </div>
      </div>

      {/* HTML 파일의 모든 슬라이드 렌더링 */}
      {htmlContent && (
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      )}
    </div>
  );
}
