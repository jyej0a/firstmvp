/**
 * @file app/dashboard/page.tsx
 * @description Trend-Hybrid Admin 메인 대시보드
 * 
 * Phase 2.5: 스크래핑 API 연동
 * - 키워드/URL 입력창
 * - 수집 시작 버튼 (API 호출)
 * - 로딩 상태 표시
 * - 결과/에러 메시지 표시
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ApiResponse, ScrapedProductRaw } from '@/types';

interface ScrapeResult {
  products: ScrapedProductRaw[];
  stats: {
    totalScraped: number;
    filteredOut?: number;
    finalCount?: number;
    duration: number;
    pagesScraped: number;
  };
}

export default function DashboardPage() {
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScrapeResult | null>(null);

  // Phase 2.5: 실제 스크래핑 API 호출
  const handleScrape = async () => {
    console.group('🔍 [Dashboard] 수집 시작');
    console.log('입력값:', searchInput);
    
    // 상태 초기화
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('📡 API 요청 전송 중...');
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchInput }),
      });

      const data: ApiResponse<ScrapeResult> = await response.json();
      console.log('📦 API 응답:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || '스크래핑에 실패했습니다.');
      }

      // 성공
      setResult(data.data!);
      console.log('✅ 스크래핑 성공!');
      console.log(`   - 스크래핑된 상품: ${data.data!.stats.totalScraped}개`);
      if (data.data!.stats.filteredOut !== undefined) {
        console.log(`   - 금지어 필터링: ${data.data!.stats.filteredOut}개 제외`);
        console.log(`   - 최종 상품: ${data.data!.stats.finalCount}개`);
      }
      console.log(`   - 소요 시간: ${(data.data!.stats.duration / 1000).toFixed(1)}초`);
      console.log(`   - 스크래핑한 페이지: ${data.data!.stats.pagesScraped}개`);
      console.log('   - 상품 목록:', data.data!.products);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error('❌ 스크래핑 실패:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      console.groupEnd();
    }
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
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleScrape()}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleScrape}
            disabled={!searchInput.trim() || isLoading}
            className="px-8"
          >
            {isLoading ? '수집 중...' : '수집 시작'}
          </Button>
        </div>

        {/* 로딩 상태 표시 */}
        {isLoading && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              ⏳ 아마존에서 상품을 수집하고 있습니다...
            </p>
          </div>
        )}

        {/* 에러 메시지 표시 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-700 dark:text-red-300">
              ❌ {error}
            </p>
          </div>
        )}

        {/* 성공 메시지 표시 */}
        {result && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-sm text-green-700 dark:text-green-300">
              ✅ {result.stats.finalCount ?? result.stats.totalScraped}개 상품을 성공적으로 수집했습니다! 
              ({(result.stats.duration / 1000).toFixed(1)}초 소요, {result.stats.pagesScraped}페이지)
              {result.stats.filteredOut !== undefined && result.stats.filteredOut > 0 && (
                <span className="block mt-1">
                  🚫 금지어 필터링: {result.stats.filteredOut}개 제외
                </span>
              )}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              💡 콘솔(F12)에서 수집된 상품 정보를 확인하세요.
            </p>
          </div>
        )}

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

      {/* 수집 목록 */}
      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">
            📋 수집 목록 ({result?.stats.finalCount ?? result?.stats.totalScraped ?? 0} items)
          </h2>
        </div>
        
        {/* 결과가 없을 때 */}
        {!result && (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">수집된 상품이 없습니다</p>
            <p className="text-sm">
              키워드를 입력하고 "수집 시작" 버튼을 클릭하세요
            </p>
          </div>
        )}

        {/* 결과가 있을 때 - 간단한 리스트 표시 (Phase 2.5: 콘솔 출력 위주) */}
        {result && result.products.length > 0 && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.products.slice(0, 6).map((product) => (
                <div 
                  key={product.asin} 
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  {product.images[0] && (
                    <img 
                      src={product.images[0]} 
                      alt={product.title}
                      className="w-full h-40 object-cover rounded mb-3"
                    />
                  )}
                  <h3 className="font-medium text-sm line-clamp-2 mb-2">
                    {product.title}
                  </h3>
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span className="font-mono">{product.asin}</span>
                    <span className="font-semibold text-primary">
                      ${product.amazonPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {result.products.length > 6 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                ... 외 {result.products.length - 6}개 상품 (콘솔에서 전체 확인 가능)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

