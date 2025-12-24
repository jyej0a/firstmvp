/**
 * @file app/dashboard/page.tsx
 * @description Trend-Hybrid Admin 대시보드 V1 (일괄 수집)
 * 
 * V1: 일괄 수집 모드
 * - 30개 상품을 한번에 수집
 * - 수동으로 선택하여 Shopify 등록
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProductList from '@/components/ProductList';
import { Menu, X } from 'lucide-react';
import type { ApiResponse, ScrapedProductRaw, Product, ShopifyUploadResult } from '@/types';

interface ScrapeResult {
  products: ScrapedProductRaw[];
  stats: {
    totalScraped: number;
    filteredOut?: number;
    saved?: number;
    failed?: number;
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
  
  // 사이드바 열림/닫힘 상태
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Phase 2.13: 상품 목록 상태
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Phase 2.21: 일괄 등록 상태
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Phase 2.13: 페이지 로드 시 상품 목록 자동 조회
  useEffect(() => {
    fetchProducts();
  }, []);

  // 상품 목록 조회 함수 (V1: products_v1 테이블 조회)
  const fetchProducts = async () => {
    console.group('📋 [Dashboard V1] 상품 목록 조회');
    setIsLoadingProducts(true);

    try {
      // V1은 products_v1 테이블 조회
      const response = await fetch('/api/products?version=v1');
      const data: ApiResponse<{
        products: Product[];
        total: number;
        limit: number;
        offset: number;
      }> = await response.json();

      console.log('📦 조회 결과:', data);

      if (response.ok && data.success && data.data) {
        setProducts(data.data.products);
        console.log(`✅ ${data.data.products.length}개 상품 조회 완료`);
      } else {
        console.error('❌ 상품 조회 실패:', data.error);
      }
    } catch (err) {
      console.error('❌ 상품 조회 중 오류:', err);
    } finally {
      setIsLoadingProducts(false);
      console.groupEnd();
    }
  };

  // Phase 2.16: 마진율 변경 핸들러
  const handleMarginChange = async (productId: string, newMargin: number) => {
    console.group('💰 [Dashboard V1] 마진율 업데이트');
    console.log(`상품 ID: ${productId}`);
    console.log(`새 마진율: ${newMargin}%`);

    try {
      // V1은 products_v1 테이블 사용
      const response = await fetch(`/api/products/${productId}?version=v1`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ marginRate: newMargin }),
      });

      const data: ApiResponse<Product> = await response.json();

      if (response.ok && data.success && data.data) {
        console.log('✅ 마진율 업데이트 성공');
        console.log(`   - 새 판매가: $${data.data.sellingPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

        // 로컬 상품 목록 업데이트
        setProducts((prevProducts) =>
          prevProducts.map((p) =>
            p.id === productId
              ? { ...p, marginRate: newMargin, sellingPrice: data.data!.sellingPrice }
              : p
          )
        );
      } else {
        console.error('❌ 마진율 업데이트 실패:', data.error);
      }
    } catch (err) {
      console.error('❌ 마진율 업데이트 중 오류:', err);
    } finally {
      console.groupEnd();
    }
  };

  // Phase 2.21: Shopify 일괄 등록 핸들러
  const handleBulkUpload = async () => {
    console.group('🛒 [Dashboard V1] Shopify 일괄 등록');
    console.log(`선택된 상품 개수: ${selectedIds.length}개`);

    // 상태 초기화
    setIsUploading(true);
    setUploadMessage(null);
    setUploadError(null);

    try {
      console.log('📡 일괄 등록 API 요청 전송 중...');
      const response = await fetch('/api/shopify/bulk-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product_ids: selectedIds }),
      });

      const data: ApiResponse<ShopifyUploadResult> = await response.json();
      console.log('📦 API 응답:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Shopify 등록에 실패했습니다.');
      }

      // 성공
      const result = data.data!;
      console.log('✅ 일괄 등록 완료!');
      console.log(`   - 총 시도: ${result.total}개`);
      console.log(`   - 성공: ${result.success}개`);
      console.log(`   - 실패: ${result.failed}개`);

      if (result.failures.length > 0) {
        console.log('   - 실패 상세:', result.failures);
      }

      // 성공 메시지 설정
      let message = `${result.success}개 상품이 Shopify에 등록되었습니다.`;
      if (result.failed > 0) {
        message += ` (${result.failed}개 실패)`;
      }
      setUploadMessage(message);

      // 실패 상세 정보를 에러로 표시 (선택 사항)
      if (result.failures.length > 0) {
        const errorDetails = result.failures
          .map((f, idx) => `${idx + 1}. ASIN ${f.asin}: ${f.error}`)
          .join('\n');
        console.error('❌ 실패 상세:\n' + errorDetails);
      }

      // 상품 목록 새로고침
      console.log('🔄 상품 목록 새로고침 중...');
      await fetchProducts();

      // 선택 초기화
      setSelectedIds([]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error('❌ 일괄 등록 실패:', errorMessage);
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      console.groupEnd();
    }
  };

  // 일괄 수집 스크래핑 시작
  const handleScrape = async () => {
    console.group('🔍 [Dashboard V1] 일괄 수집 시작');
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

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || '스크래핑에 실패했습니다.');
      }

      setResult(data.data);
      console.log('✅ 일괄 수집 완료!');
      console.log(`   - 수집된 상품: ${data.data.products.length}개`);
      console.log(`   - 저장된 상품: ${data.data.stats.saved || 0}개`);
      console.log(`   - 소요 시간: ${(data.data.stats.duration / 1000).toFixed(2)}초`);

      // 상품 목록 새로고침
      await fetchProducts();

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
    <div className="flex min-h-screen bg-terminal">
      {/* 왼쪽 사이드바 */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-50 transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* 사이드바 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-2xl font-bold">Nav</h2>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 메뉴 항목 */}
        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <button
                className="w-full text-left px-4 py-3 rounded-none hover:bg-accent transition-colors text-sm font-medium"
                onClick={() => {
                  // 실제 동작은 필요 없음
                  console.log('Dashboard 클릭');
                }}
              >
                Dashboard
              </button>
            </li>
            <li>
              <button
                className="w-full text-left px-4 py-3 rounded-none hover:bg-accent transition-colors text-sm font-medium"
                onClick={() => {
                  // 실제 동작은 필요 없음
                  console.log('Margin Rate 클릭');
                }}
              >
                Margin Rate
              </button>
            </li>
            <li>
              <button
                className="w-full text-left px-4 py-3 rounded-none hover:bg-accent transition-colors text-sm font-medium"
                onClick={() => {
                  // 실제 동작은 필요 없음
                  console.log('Editor 클릭');
                }}
              >
                Editor
              </button>
            </li>
            <li>
              <button
                className="w-full text-left px-4 py-3 rounded-none hover:bg-accent transition-colors text-sm font-medium"
                onClick={() => {
                  // 실제 동작은 필요 없음
                  console.log('History 클릭');
                }}
              >
                History
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* 오버레이 (모바일용) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 메인 컨텐츠 */}
      <div className="flex-1 lg:ml-64">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* 헤더 - 햄버거 메뉴 버튼 포함 */}
          <div className="mb-8 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold mb-2">dashboard</h1>
        <p className="text-muted-foreground">
            
        </p>
            </div>
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
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              // AI 임시 추천 기능
              console.log('🤖 AI 추천 기능 실행 (임시)');
              alert('AI가 추천 상품을 추출 중입니다... (임시 기능)');
            }}
          >
            Recommend
          </Button>
        </div>
      </div>

      {/* 메인 액션: 키워드 또는 URL 입력 & 일괄 수집 */}
      <div className="mb-6 p-6 bg-card rounded-none border">
        <h2 className="text-lg font-semibold mb-4">
          Enter URL or Keyword
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

        {/* 결과 메시지 표시 */}
        {result && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-none">
            <p className="text-sm text-green-700 dark:text-green-300">
              ✅ {result.products.length}개 상품 수집 완료! ({result.stats.saved || 0}개 저장됨)
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              ⏱️ 소요 시간: {(result.stats.duration / 1000).toFixed(2)}초
            </p>
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
            <span>금지어 자동 필터링 적용 (ON)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4"
              disabled
            />
            <span>최대 30개 상품 수집</span>
          </label>
        </div>
      </div>

      {/* Phase 2.21: 선택 등록 버튼 */}
      {products.length > 0 && (
        <div className="mb-6 p-4 bg-card rounded-none border">
          <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">
            {selectedIds.length > 0 ? (
              <span>
                <span className="font-bold text-primary">{selectedIds.length}개</span> 상품 선택됨
              </span>
            ) : (
              <span>상품을 선택하고 &quot;선택 등록&quot; 버튼을 클릭하세요</span>
            )}
          </div>
          <Button
              onClick={handleBulkUpload}
              disabled={selectedIds.length === 0 || isUploading}
            className="px-6"
          >
              {isUploading ? '등록 중...' : `선택 등록 (${selectedIds.length})`}
          </Button>
          </div>

          {/* 업로드 진행 중 메시지 */}
          {isUploading && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-none">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                ⏳ Shopify에 상품을 등록하고 있습니다. 잠시만 기다려주세요...
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                💡 상품이 많을수록 시간이 더 걸릴 수 있습니다.
              </p>
            </div>
          )}

          {/* 업로드 성공 메시지 */}
          {uploadMessage && !isUploading && (
            <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-none">
              <p className="text-sm text-green-700 dark:text-green-300">
                ✅ {uploadMessage}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                💡 Shopify Dashboard에서 등록된 상품을 확인하세요.
              </p>
            </div>
          )}

          {/* 업로드 에러 메시지 */}
          {uploadError && !isUploading && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-none">
              <p className="text-sm text-red-700 dark:text-red-300">
                ❌ {uploadError}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Phase 2.13: ProductList 컴포넌트 통합 */}
      <ProductList
        products={products}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onMarginChange={handleMarginChange}
        isLoading={isLoadingProducts}
      />
        </div>
      </div>
    </div>
  );
}
