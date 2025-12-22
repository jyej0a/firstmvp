/**
 * @file app/dashboard-v2/products/page.tsx
 * @description 상품 목록 페이지
 * 
 * 수집된 상품 목록을 관리하는 페이지
 * - 상품 목록 표시
 * - 상태 필터링
 * - 페이지네이션
 * - 일괄 등록
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import ProductList from '@/components/ProductList';
import type { ApiResponse, Product, ShopifyUploadResult } from '@/types';

export default function ProductsPage() {
  // 상품 목록 상태
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // 상태 필터링
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'uploaded' | 'error'>('all');

  // 일괄 등록 상태
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 페이지 로드 시 상품 목록 자동 조회
  useEffect(() => {
    fetchProducts();
  }, [currentPage, itemsPerPage, statusFilter]);

  // 상품 목록 조회 함수
  const fetchProducts = async () => {
    console.group('📋 [Products] 상품 목록 조회');
    setIsLoadingProducts(true);

    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const url = statusFilter === 'all'
        ? `/api/products?limit=${itemsPerPage}&offset=${offset}`
        : `/api/products?limit=${itemsPerPage}&offset=${offset}&status=${statusFilter}`;

      const response = await fetch(url);
      const data: ApiResponse<{
        products: Product[];
        total: number;
        limit: number;
        offset: number;
      }> = await response.json();

      console.log('📦 조회 결과:', data);

      if (response.ok && data.success && data.data) {
        setProducts(data.data.products);
        setTotalProducts(data.data.total);
        setTotalPages(Math.ceil(data.data.total / itemsPerPage));
        console.log(`✅ ${data.data.products.length}개 상품 조회 완료 (전체 ${data.data.total}개)`);
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

  // 마진율 변경 핸들러
  const handleMarginChange = async (productId: string, newMargin: number) => {
    console.group('💰 [Products] 마진율 업데이트');
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

  // Shopify 일괄 등록 핸들러
  const handleBulkUpload = async () => {
    console.group('🛒 [Products] Shopify 일괄 등록');
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Product List</h1>
        <p className="text-muted-foreground">
          Manage collected products & Shopify registration
        </p>
      </div>

      {/* 선택 등록 버튼 */}
      {products.length > 0 && (
        <div className="mb-6 p-4 bg-card rounded-none border">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">
              {selectedIds.length > 0 ? (
                <span>
                  <span className="font-bold text-primary">{selectedIds.length}</span> products selected
                </span>
              ) : (
                <span>Select products and click &quot;Bulk Upload&quot; button</span>
              )}
            </div>
            <Button
              onClick={handleBulkUpload}
              disabled={selectedIds.length === 0 || isUploading}
              className="px-6"
            >
              {isUploading ? 'Uploading...' : `Bulk Upload (${selectedIds.length})`}
            </Button>
          </div>

          {/* 업로드 진행 중 메시지 */}
          {isUploading && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-none">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                ⏳ Uploading products to Shopify. Please wait...
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                💡 More products may take longer to process.
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
                💡 Check registered products in Shopify Dashboard.
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

      {/* 상태 필터링 */}
      <div className="mb-6 p-4 bg-card rounded-none border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Filter</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1); // 페이지 크기 변경 시 첫 페이지로
              }}
              className="px-3 py-1 border border-input bg-background rounded-none text-sm"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setCurrentPage(1);
            }}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'draft' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter('draft');
              setCurrentPage(1);
            }}
          >
            Draft
          </Button>
          <Button
            variant={statusFilter === 'uploaded' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter('uploaded');
              setCurrentPage(1);
            }}
          >
            Uploaded
          </Button>
          <Button
            variant={statusFilter === 'error' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter('error');
              setCurrentPage(1);
            }}
          >
            Error
          </Button>
        </div>
      </div>

      {/* ProductList 컴포넌트 */}
      <ProductList
        products={products}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onMarginChange={handleMarginChange}
        isLoading={isLoadingProducts}
      />

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || isLoadingProducts}
          >
            Previous
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  disabled={isLoadingProducts}
                  className="min-w-[40px]"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || isLoadingProducts}
          >
            Next
          </Button>
        </div>
      )}

      {/* 페이지 정보 */}
      <div className="mt-4 text-center text-sm text-muted-foreground">
        {totalProducts > 0 ? (
          <span>
            Showing {((currentPage - 1) * itemsPerPage + 1).toLocaleString()}-
            {Math.min(currentPage * itemsPerPage, totalProducts).toLocaleString()} of {totalProducts.toLocaleString()} products
            {statusFilter !== 'all' && ` (${statusFilter} filter applied)`}
          </span>
        ) : (
          <span>No products available</span>
        )}
      </div>
    </div>
  );
}

