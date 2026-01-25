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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import ScrapingProgress from '@/components/ScrapingProgress';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { ApiResponse, Product } from '@/types';

export default function ScrapePage() {
  const [searchInput, setSearchInput] = useState('');
  const [targetCount, setTargetCount] = useState<string>(''); // 목표 개수
  const [isAutoSync, setIsAutoSync] = useState(true); // true = Collect & Sync (기본값)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 순차 처리 Job ID 상태
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // 오늘(KST) 수집 상품 목록 (상태: draft/uploaded/error 모두)
  const [todayProducts, setTodayProducts] = useState<Product[]>([]);
  const [isLoadingTodayProducts, setIsLoadingTodayProducts] = useState(false);
  const [todayProductsError, setTodayProductsError] = useState<string | null>(null);
  const [currentJobStatus, setCurrentJobStatus] = useState<string | null>(null);

  const safeParseApiResponse = async <T,>(
    response: Response
  ): Promise<ApiResponse<T>> => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as ApiResponse<T>;
    }

    const text = await response.text();
    throw new Error(
      `서버 응답이 JSON이 아닙니다. (status=${response.status})\n` + text.slice(0, 500)
    );
  };

  // 페이지 로드 시 활성 Job 확인 및 복원
  useEffect(() => {
    const restoreActiveJob = async () => {
      console.group('🔄 [Scrape] 활성 Job 복원 시도');
      
      try {
        const response = await fetch('/api/scrape-v2/active');
        const data = await safeParseApiResponse<any>(response);

        if (response.ok && data.success && data.data) {
          const activeJob = data.data;
          console.log(`✅ 활성 Job 발견: ${activeJob.id}`);
          console.log(`   상태: ${activeJob.status}`);
          console.log(`   진행: ${activeJob.current_count}/${activeJob.total_target}`);
          
          // 실행 중인 Job만 복원 (paused/completed는 복원하지 않음)
          if (activeJob.status === 'running') {
            setCurrentJobId(activeJob.id);
            setIsLoading(true);
            console.log('🔄 실행 중인 Job을 복원합니다.');
          } else {
            console.log(`ℹ️  Job이 ${activeJob.status} 상태이므로 복원하지 않습니다.`);
          }
        } else {
          console.log('ℹ️  활성 Job 없음');
        }
      } catch (err) {
        console.error('❌ 활성 Job 복원 실패:', err);
      } finally {
        console.groupEnd();
      }
    };

    restoreActiveJob();
  }, []); // 페이지 로드 시 한 번만 실행

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
          totalTarget: 30, // 화면 녹화용 30개 (약 90초 소요, 3초 간격)
        }),
      });

      const data = await safeParseApiResponse<{ jobId: string; message: string }>(response);
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
      // 목표 개수: 입력값 있으면 사용, 없으면 1000개 (기본값)
      const finalTargetCount = targetCount ? parseInt(targetCount, 10) : 1000;
      
      const response = await fetch('/api/scrape-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          searchInput,
          totalTarget: finalTargetCount,
          scrapingMode: isAutoSync ? "collect_sync" : "collect_only",
        }),
      });

      const data = await safeParseApiResponse<{ jobId: string; message: string }>(response);
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
    // Job이 완료/중지되면 currentJobId를 초기화하여 폴링 중지
    setCurrentJobId(null);
  };


  // 오늘(KST) 수집 현황 조회 (Job 상태와 무관하게 계속 누적 표시)
  useEffect(() => {
    let isActive = true; // cleanup 플래그
    let timer: ReturnType<typeof setTimeout> | null = null;
    let isFirstLoad = true; // 첫 로딩 여부

    const fetchTodayProducts = async () => {
      if (!isActive) return;

      // 첫 로딩일 때만 로딩 상태 표시 (깜빡임 방지)
      if (isFirstLoad) {
        setIsLoadingTodayProducts(true);
      }
      setTodayProductsError(null);

      try {
        // 1) Job 상태 확인 (있는 경우에만) - 폴링 간격 결정용
        if (currentJobId) {
          const jobResponse = await fetch(`/api/scrape-v2/${currentJobId}`);
          const jobData = await safeParseApiResponse<any>(jobResponse);
          if (jobResponse.ok && jobData.success && jobData.data) {
            const jobStatus = jobData.data.status as string;
            setCurrentJobStatus(jobStatus);
          } else {
            setCurrentJobStatus(null);
          }
        } else {
          setCurrentJobStatus(null);
        }

        // 2) 오늘(KST) 수집 상품 전체 조회 (상태 모두 포함)
        const response = await fetch(`/api/products?version=v2&todayKst=true&limit=1000&offset=0`);
        const data = await safeParseApiResponse<{
          products: Product[];
          total: number;
          limit: number;
          offset: number;
        }>(response);

        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error || '오늘 수집 현황 조회에 실패했습니다.');
        }

        const newProducts = data.data.products;
        setTodayProducts((prev) => {
          const prevIds = prev.map((p) => p.id).join(',');
          const newIds = newProducts.map((p) => p.id).join(',');
          if (prevIds !== newIds) {
            console.log(`📦 오늘 수집 현황 업데이트: ${newProducts.length}개`);
            return newProducts;
          }
          return prev;
        });
        
        // 첫 로딩 완료 표시
        if (isFirstLoad) {
          isFirstLoad = false;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        console.error('❌ 오늘 수집 현황 조회 실패:', message);
        setTodayProductsError(message);
      } finally {
        // 첫 로딩일 때만 로딩 상태 해제 (깜빡임 방지)
        if (isFirstLoad) {
          setIsLoadingTodayProducts(false);
          isFirstLoad = false;
        }

        // 3) 다음 폴링 예약 (running이면 10초, 아니면 60초)
        const nextMs = currentJobStatus === 'running' ? 10_000 : 60_000;
        if (isActive) {
          timer = setTimeout(fetchTodayProducts, nextMs);
        }
      }
    };

    // 즉시 한 번 조회
    fetchTodayProducts();

    return () => {
      isActive = false;
      if (timer) clearTimeout(timer);
    };
  }, [currentJobId, currentJobStatus]);

  const todayCounts = (() => {
    const total = todayProducts.length;
    const draft = todayProducts.filter((p) => p.status === 'draft').length;
    const uploaded = todayProducts.filter((p) => p.status === 'uploaded').length;
    const errorCount = todayProducts.filter((p) => p.status === 'error').length;
    return { total, draft, uploaded, error: errorCount };
  })();

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

        <div className="space-y-3">
          {/* 키워드 입력 */}
          <div className="flex gap-2">
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

          {/* 목표 개수 입력 (옵션) */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">
              Target Count:
            </label>
            <Input
              type="number"
              placeholder="Leave empty for 1000 (default)"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              disabled={isLoading}
              className="w-48"
              min="1"
              max="1000"
            />
            <span className="text-xs text-muted-foreground">
              {targetCount ? `${targetCount} items` : '1000 items (default)'}
            </span>
          </div>

          {/* 수집 모드 선택 */}
          <div className="p-4 bg-muted/50 rounded-none border">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label htmlFor="auto-sync" className="text-base font-semibold cursor-pointer">
                  {isAutoSync ? "Collect & Sync (자동 등록)" : "Collect Only (수집만)"}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {isAutoSync 
                    ? "수집된 상품을 즉시 Shopify에 자동 등록합니다"
                    : "수집만 진행하고, 상품 목록 페이지에서 직접 등록할 수 있습니다"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  id="auto-sync"
                  checked={isAutoSync}
                  onCheckedChange={setIsAutoSync}
                  disabled={isLoading}
                  className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 순차 처리 진행 상황 표시 */}
        {currentJobId && (
          <div className="mb-4">
            <ScrapingProgress
              jobId={currentJobId}
              pollingInterval={1000}
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
      <div className="mb-6 p-6 bg-card rounded-none border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">오늘 수집 현황 (KST)</h2>
              <p className="text-sm text-muted-foreground">
                오늘 수집한 상품이 누적(스택)되어 표시됩니다. ProductList에서 전체 상품을 확인할 수 있습니다.
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

          {/* 요약 카운트 */}
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-none font-medium">
              Total: <span className="text-primary font-bold">{todayCounts.total.toLocaleString()}</span>
            </span>
            <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-none font-medium">
              수집 중: <span className="font-bold">{todayCounts.draft.toLocaleString()}</span>
            </span>
            <span className="px-3 py-1.5 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-none font-medium">
              완료: <span className="font-bold">{todayCounts.uploaded.toLocaleString()}</span>
            </span>
            <span className="px-3 py-1.5 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-none font-medium">
              실패: <span className="font-bold">{todayCounts.error.toLocaleString()}</span>
            </span>
          </div>

          {todayProductsError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-none">
              <p className="text-sm text-red-700 dark:text-red-300">
                ❌ {todayProductsError}
              </p>
            </div>
          )}

          {isLoadingTodayProducts ? (
            <div className="text-center py-8 text-muted-foreground">
              오늘 수집 현황을 불러오는 중...
            </div>
          ) : todayProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              아직 수집된 상품이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">NO</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">ASIN</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">URL</th>
                    <th className="text-center py-3 px-4 font-semibold text-muted-foreground w-20">완료</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {todayProducts.map((product, index) => (
                    <tr
                      key={product.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* NO */}
                      <td className="py-3 px-4 text-muted-foreground font-mono">
                        {index + 1}
                      </td>

                      {/* ASIN */}
                      <td className="py-3 px-4 font-mono text-xs">
                        {product.asin}
                      </td>

                      {/* URL */}
                      <td className="py-3 px-4">
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-md"
                          title={product.url}
                        >
                          {product.url}
                        </a>
                      </td>

                      {/* 완료 상태 */}
                      <td className="py-3 px-4 text-center">
                        {product.status === 'uploaded' && (
                          <div className="flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          </div>
                        )}
                        {product.status === 'draft' && (
                          <div className="flex items-center justify-center">
                            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                          </div>
                        )}
                        {product.status === 'error' && (
                          <div className="flex items-center justify-center">
                            <XCircle className="h-5 w-5 text-red-500" />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ProductList 바로가기 버튼 (하단) */}
          {todayProducts.length > 0 && (
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
    </div>
  );
}

