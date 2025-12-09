/**
 * @file app/dashboard/page.tsx
 * @description Trend-Hybrid Admin 메인 대시보드
 * 
 * Phase 2.13: 대시보드 통합
 * - 키워드/URL 입력창
 * - 수집 시작 버튼 (API 호출)
 * - 상품 목록 조회 및 표시 (ProductList)
 * - 체크박스 선택 및 "선택 등록" 버튼
 * - 로딩 상태 표시
 * - 결과/에러 메시지 표시
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProductList from '@/components/ProductList';
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

  // 상품 목록 조회 함수
  const fetchProducts = async () => {
    console.group('📋 [Dashboard] 상품 목록 조회');
    setIsLoadingProducts(true);

    try {
      const response = await fetch('/api/products');
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
    console.group('💰 [Dashboard] 마진율 업데이트');
    console.log(`상품 ID: ${productId}`);
    console.log(`새 마진율: ${newMargin}%`);

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ marginRate: newMargin }),
      });

      const data: ApiResponse<Product> = await response.json();

      if (response.ok && data.success && data.data) {
        console.log('✅ 마진율 업데이트 성공');
        console.log(`   - 새 판매가: $${data.data.sellingPrice.toFixed(2)}`);

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
    console.group('🛒 [Dashboard] Shopify 일괄 등록');
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
      }
      if (data.data!.stats.saved !== undefined) {
        console.log(`   - DB 저장: ${data.data!.stats.saved}개 성공`);
      }
      if (data.data!.stats.failed !== undefined && data.data!.stats.failed > 0) {
        console.log(`   - DB 저장 실패: ${data.data!.stats.failed}개`);
      }
      console.log(`   - 소요 시간: ${(data.data!.stats.duration / 1000).toFixed(1)}초`);
      console.log(`   - 스크래핑한 페이지: ${data.data!.stats.pagesScraped}개`);
      console.log('   - 상품 목록:', data.data!.products);

      // Phase 2.13: 수집 완료 후 상품 목록 새로고침
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
              ✅ 스크래핑 완료: {result.stats.totalScraped}개 수집
              {result.stats.filteredOut !== undefined && result.stats.filteredOut > 0 && (
                <>, {result.stats.filteredOut}개 필터링</>
              )}
              {result.stats.saved !== undefined && (
                <>, {result.stats.saved}개 저장 완료</>
              )}
              {result.stats.failed !== undefined && result.stats.failed > 0 && (
                <> ({result.stats.failed}개 저장 실패)</>
              )}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              ⏱️  소요 시간: {(result.stats.duration / 1000).toFixed(1)}초 | 📄 페이지: {result.stats.pagesScraped}개
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              💡 Supabase Dashboard에서 저장된 상품을 확인하세요.
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

      {/* Phase 2.21: 선택 등록 버튼 */}
      {products.length > 0 && (
        <div className="mb-6 p-4 bg-card rounded-lg border">
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
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
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
            <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
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
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
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
  );
}

