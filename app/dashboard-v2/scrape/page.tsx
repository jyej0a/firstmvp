/**
 * @file app/dashboard-v2/scrape/page.tsx
 * @description 수집 시작 페이지
 * 
 * 아마존 상품 수집을 시작하는 페이지
 * - 키워드 또는 URL 입력
 * - 순차 처리 스크래핑 시작
 * - 진행 상황 실시간 표시
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ScrapingProgress from '@/components/ScrapingProgress';
import Image from 'next/image';
import Link from 'next/link';
import type { ApiResponse, Product } from '@/types';

export default function ScrapePage() {
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 순차 처리 Job ID 상태
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // 수집 중인 상품 목록 (draft 상태)
  const [collectingProducts, setCollectingProducts] = useState<Product[]>([]);
  const [isLoadingCollectingProducts, setIsLoadingCollectingProducts] = useState(false);

  // 더미 테스트 스크래핑 (테스트용)
  const handleDummyTest = async () => {
    console.group('🧪 [Scrape] 더미 테스트 수집 시작');
    
    // 상태 초기화
    setIsLoading(true);
    setError(null);
    setCurrentJobId(null);

    try {
      console.log('📡 더미 테스트 API 요청 전송 중...');
      const response = await fetch('/api/scrape-v2/dummy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          totalTarget: 5, // 테스트용 5개만
        }),
      });

      const data: ApiResponse<{ jobId: string; message: string }> = await response.json();
      console.log('📦 API 응답:', data);

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || '더미 테스트 작업 시작에 실패했습니다.');
      }

      // Job ID 저장
      setCurrentJobId(data.data.jobId);
      console.log('✅ 더미 테스트 작업 시작됨!');
      console.log(`   - Job ID: ${data.data.jobId}`);
      console.log(`   - 메시지: ${data.data.message}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error('❌ 더미 테스트 작업 시작 실패:', errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    } finally {
      console.groupEnd();
    }
  };

  // 순차 처리 스크래핑 시작
  const handleScrape = async () => {
    console.group('🔍 [Scrape] 순차 처리 수집 시작');
    console.log('입력값:', searchInput);

    // 상태 초기화
    setIsLoading(true);
    setError(null);
    setCurrentJobId(null);

    try {
      console.log('📡 API 요청 전송 중...');
      const response = await fetch('/api/scrape-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          searchInput,
          totalTarget: 1000, // 하루 최대 1000개
        }),
      });

      const data: ApiResponse<{ jobId: string; message: string }> = await response.json();
      console.log('📦 API 응답:', data);

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || '스크래핑 작업 시작에 실패했습니다.');
      }

      // Job ID 저장
      setCurrentJobId(data.data.jobId);
      console.log('✅ 순차 처리 작업 시작됨!');
      console.log(`   - Job ID: ${data.data.jobId}`);
      console.log(`   - 메시지: ${data.data.message}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error('❌ 스크래핑 작업 시작 실패:', errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    } finally {
      console.groupEnd();
    }
  };

  // 작업 완료 시 콜백
  const handleJobComplete = () => {
    console.log('✅ 순차 처리 작업 완료');
    setIsLoading(false);
  };


  // Job이 시작되면 수집 중인 상품 목록 조회 시작
  useEffect(() => {
    if (!currentJobId) {
      // Job이 없으면 목록 초기화
      setCollectingProducts([]);
      return;
    }

    // 즉시 한 번 조회
    const fetchOnce = async () => {
      setIsLoadingCollectingProducts(true);
      try {
        // 현재 Job에 속한 draft 상품만 조회
        const response = await fetch(`/api/products?status=draft&jobId=${currentJobId}&limit=100`);
        const data: ApiResponse<{
          products: Product[];
          total: number;
          limit: number;
          offset: number;
        }> = await response.json();

        if (response.ok && data.success && data.data) {
          const draftProducts = data.data.products.filter(p => p.status === 'draft');
          // 깜빡임 방지: 실제로 변경된 경우에만 업데이트
          setCollectingProducts(prev => {
            const prevIds = prev.map(p => p.id).sort().join(',');
            const newIds = draftProducts.map(p => p.id).sort().join(',');
            if (prevIds !== newIds) {
              console.log(`📦 수집 중인 상품 업데이트: ${draftProducts.length}개`);
              return draftProducts;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('❌ 수집 중인 상품 조회 실패:', err);
      } finally {
        setIsLoadingCollectingProducts(false);
      }
    };

    fetchOnce();

    // 5초마다 자동 새로고침 (uploaded 상태가 되면 자동으로 제거됨)
    const interval = setInterval(async () => {
      setIsLoadingCollectingProducts(true);
      try {
        // 현재 Job에 속한 draft 상품만 조회
        const response = await fetch(`/api/products?status=draft&jobId=${currentJobId}&limit=100`);
        const data: ApiResponse<{
          products: Product[];
          total: number;
          limit: number;
          offset: number;
        }> = await response.json();

        if (response.ok && data.success && data.data) {
          const draftProducts = data.data.products.filter(p => p.status === 'draft');
          // 깜빡임 방지: 실제로 변경된 경우에만 업데이트
          setCollectingProducts(prev => {
            const prevIds = prev.map(p => p.id).sort().join(',');
            const newIds = draftProducts.map(p => p.id).sort().join(',');
            if (prevIds !== newIds) {
              console.log(`📦 수집 중인 상품 업데이트: ${draftProducts.length}개`);
              return draftProducts;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('❌ 수집 중인 상품 조회 실패:', err);
      } finally {
        setIsLoadingCollectingProducts(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentJobId]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Start.</h1>
        <p className="text-muted-foreground">
          Sequential Mode (1 item/min, auto registration)
        </p>
      </div>

      {/* 🚀 Quick Links (트렌드 숏컷) */}
      <div className="mb-6 p-4 bg-card rounded-none border">
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
           TREND SHORTCUTS
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

      {/* 메인 액션: 키워드 또는 URL 입력 & 순차 수집 */}
      <div className="mb-6 p-6 bg-card rounded-none border">
        <h2 className="text-lg font-semibold mb-4">
          Enter URL or Keyword
        </h2>

        <div className="flex gap-2 mb-4">
          <Input
            placeholder="🔍 Enter keyword or paste Amazon URL..."
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
            {isLoading ? 'Scraping...' : 'Start.'}
          </Button>
          <Button
            onClick={handleDummyTest}
            disabled={isLoading}
            variant="outline"
            title="Test with dummy data (5 products, 5s interval)"
          >
            🧪 Dummy Test
          </Button>
        </div>

        {/* 순차 처리 진행 상황 표시 */}
        {currentJobId && (
          <div className="mb-4">
            <ScrapingProgress
              jobId={currentJobId}
              pollingInterval={5000}
              apiPath="/api/scrape-v2"
              onComplete={handleJobComplete}
            />
          </div>
        )}

        {/* 에러 메시지 표시 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-none">
            <p className="text-sm text-red-700 dark:text-red-300">
              ❌ {error}
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
            <span>Auto-filter banned keywords (ON)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4"
              disabled
            />
            <span>Max 1000 items/day (1 item/min)</span>
          </label>
        </div>
      </div>

      {/* 수집 중인 상품 목록 */}
      {currentJobId && (
        <div className="mb-6 p-6 bg-card rounded-none border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">수집 중인 상품</h2>
              <p className="text-sm text-muted-foreground">
                등록이 완료되면 자동으로 ProductList로 이동합니다.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/dashboard-v2/products', '_blank')}
            >
              📋 ProductList 바로가기
            </Button>
          </div>

          {isLoadingCollectingProducts ? (
            <div className="text-center py-8 text-muted-foreground">
              수집 중인 상품을 불러오는 중...
            </div>
          ) : collectingProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              아직 수집된 상품이 없습니다.
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {collectingProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-4 p-3 border rounded-none hover:bg-muted/30 transition-colors"
                >
                  {/* 이미지 */}
                  <div className="relative w-16 h-16 flex-shrink-0">
                    {product.images[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.title}
                        fill
                        className="object-cover rounded-none"
                        sizes="64px"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted rounded-none flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No Image</span>
                      </div>
                    )}
                  </div>

                  {/* 상품 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1" title={product.title}>
                      {product.title}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>ASIN: {product.asin}</span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-none">
                        Draft
                      </span>
                    </div>
                  </div>

                  {/* 가격 정보 */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold">
                      ${product.sellingPrice.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      마진: {product.marginRate}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ProductList 바로가기 버튼 (하단) */}
          {collectingProducts.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="default"
                className="w-full"
                onClick={() => window.open('/dashboard-v2/products', '_blank')}
              >
                📋 ProductList에서 전체 상품 보기 (새 창)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

