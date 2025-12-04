/**
 * @file app/dashboard/page.tsx
 * @description Trend-Hybrid Admin 메인 대시보드
 * 
 * Phase 1.1: 최소 UI 구성
 * - 키워드/URL 입력창
 * - 수집 시작 버튼
 * - 트렌드 숏컷 버튼
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DashboardPage() {
  const [searchInput, setSearchInput] = useState('');

  // Phase 1.1: 콘솔 출력만 (스크래핑 로직 없음)
  const handleScrape = () => {
    console.log('🔍 수집 시작 - 입력값:', searchInput);
    alert(`입력하신 값: ${searchInput}\n\n(Phase 1.1: UI 테스트 단계)`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Trend-Hybrid Admin</h1>
        <p className="text-muted-foreground">
          트렌드 상품 수집 및 등록 시스템
        </p>
      </div>

      {/* 🚀 Quick Links (트렌드 숏컷) */}
      <div className="mb-6 p-4 bg-card rounded-lg border">
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
          🚀 TREND SHORTCUTS
        </h2>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://www.kalodata.com', '_blank')}
          >
            🔗 Kalodata
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open('https://www.amazon.com/Best-Sellers/zgbs', '_blank')
            }
          >
            📦 Amazon BSR
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                'https://www.tiktok.com/tag/tiktokmademebuyit',
                '_blank'
              )
            }
          >
            💡 TikTok Trends
          </Button>
        </div>
      </div>

      {/* 메인 액션: 키워드 또는 URL 입력 & 일괄 수집 */}
      <div className="mb-6 p-6 bg-card rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">
          키워드 또는 URL 입력 & 일괄 수집
        </h2>

        <div className="flex gap-2 mb-4">
          <Input
            placeholder="🔍 키워드 입력 또는 Amazon URL 붙여넣기..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
            className="flex-1"
          />
          <Button
            onClick={handleScrape}
            disabled={!searchInput.trim()}
            className="px-8"
          >
            수집 시작
          </Button>
        </div>

        {/* 체크박스 옵션 */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4"
            />
            <span>금지어 자동 필터링 적용 (ON)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4"
            />
            <span>50개 상품 Max 수집</span>
          </label>
        </div>
      </div>

      {/* 수집 목록 (Phase 4에서 구현 예정) */}
      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">
            📋 수집 목록 (0 items)
          </h2>
        </div>
        <div className="p-12 text-center text-muted-foreground">
          <p className="text-lg mb-2">수집된 상품이 없습니다</p>
          <p className="text-sm">
            키워드를 입력하고 "수집 시작" 버튼을 클릭하세요
          </p>
        </div>
      </div>
    </div>
  );
}

