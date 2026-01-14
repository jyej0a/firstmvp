/**
 * @file components/ProductList.tsx
 * @description 상품 목록 테이블 컴포넌트
 *
 * 이 컴포넌트는 수집된 상품들을 테이블 형태로 표시하며,
 * 체크박스를 통한 다중 선택과 마진율 입력 기능을 제공합니다.
 *
 * 주요 기능:
 * 1. 상품 목록 테이블 표시
 * 2. 전체 선택/해제 (헤더)
 * 3. 개별 선택 (각 행)
 * 4. 선택된 개수 표시
 * 5. 1688.com (알리바바 도매) 이미지 검색 브릿지 (이미지 클릭)
 * 6. 마진율 실시간 입력 및 가격 재계산
 * 7. 빈 리스트 상태 UI
 * 8. 반응형 테이블 스크롤
 *
 * @see {@link /docs/PRD.md} - 상품 리스트 UI 디자인
 */

"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { Product } from "@/types";
import { calculateSellingPriceUS } from "@/lib/pricing/calculator";

interface ProductListProps {
  /** 표시할 상품 목록 */
  products: Product[];

  /** 선택된 상품 ID 배열 */
  selectedIds: string[];

  /** 선택 상태 변경 콜백 */
  onSelectionChange: (selectedIds: string[]) => void;

  /** 마진율 변경 콜백 */
  onMarginChange?: (productId: string, newMargin: number) => void;

  /** 로딩 상태 */
  isLoading?: boolean;

  /** 버전 (v1 또는 v2, 기본값: v1) */
  version?: 'v1' | 'v2';
}

/**
 * 상품 상태 배지 컴포넌트
 */
function StatusBadge({ status }: { status: Product["status"] }) {
  const statusConfig = {
    draft: {
      label: "Draft",
      className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    },
    uploaded: {
      label: "Uploaded",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    },
    error: {
      label: "Error",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-none ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export default function ProductList({
  products,
  selectedIds,
  onSelectionChange,
  onMarginChange,
  isLoading = false,
  version = 'v1',
}: ProductListProps) {
  // 전체 선택 상태
  const [isAllSelected, setIsAllSelected] = useState(false);

  // 마진율 입력 상태 (로컬 상태로 관리)
  const [localMargins, setLocalMargins] = useState<Record<string, number>>({});

  // 계산된 판매가 (로컬 상태로 관리)
  const [localPrices, setLocalPrices] = useState<Record<string, number>>({});

  // 전체 선택 상태 업데이트
  useEffect(() => {
    if (products.length === 0) {
      setIsAllSelected(false);
      return;
    }
    setIsAllSelected(
      products.length > 0 && selectedIds.length === products.length
    );
  }, [products.length, selectedIds.length]);

  // 상품 목록이 변경되면 로컬 마진율/가격 초기화
  useEffect(() => {
    const margins: Record<string, number> = {};
    const prices: Record<string, number> = {};

    products.forEach((product) => {
      margins[product.id] = product.marginRate;
      prices[product.id] = product.sellingPrice;
    });

    setLocalMargins(margins);
    setLocalPrices(prices);
  }, [products]);

  // 전체 선택/해제 핸들러
  const handleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(products.map((p) => p.id));
    }
  };

  // 개별 선택 핸들러
  const handleSelectOne = (productId: string) => {
    if (selectedIds.includes(productId)) {
      onSelectionChange(selectedIds.filter((id) => id !== productId));
    } else {
      onSelectionChange([...selectedIds, productId]);
    }
  };

  // 1688.com (알리바바 도매) 이미지 검색
  const handleImageClick = (sourceUrl: string) => {
    // 아마존 원본 페이지로 이동
    console.log("🔗 아마존 원본 페이지 이동:", sourceUrl);
    window.open(sourceUrl, "_blank", "noopener,noreferrer");
  };

  // 마진율 변경 핸들러
  const handleMarginChange = (productId: string, product: Product, newMargin: string) => {
    const marginValue = parseFloat(newMargin);

    // 유효성 검증
    if (isNaN(marginValue) || marginValue < 0 || marginValue > 100) {
      return;
    }

    // 로컬 마진율 업데이트
    setLocalMargins((prev) => ({
      ...prev,
      [productId]: marginValue,
    }));

    // 판매가 즉시 재계산 (US 타입만 지원, MVP 1.0)
    try {
      const newPrice = calculateSellingPriceUS(product.amazonPrice, marginValue);
      setLocalPrices((prev) => ({
        ...prev,
        [productId]: newPrice,
      }));

      console.log(`💰 가격 재계산: ${product.title.substring(0, 30)}...`);
      console.log(`   마진율: ${marginValue}%`);
      console.log(`   판매가: $${newPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    } catch (error) {
      console.error("가격 계산 오류:", error);
    }
  };

  // 마진율 입력 완료 (blur) 핸들러 - API 호출
  const handleMarginBlur = (productId: string, newMargin: number) => {
    if (onMarginChange) {
      onMarginChange(productId, newMargin);
    }
  };

  // 빈 리스트 상태
  if (!isLoading && products.length === 0) {
    return (
      <div className="bg-card rounded-none border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">
            📋 List (0 items)
          </h2>
        </div>
        <div className="p-12 text-center text-muted-foreground">
          <p className="text-lg mb-2">수집된 상품이 없습니다</p>
          <p className="text-sm">
            키워드를 입력하고 &quot;수집 시작&quot; 버튼을 클릭하세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-none border">
      {/* 헤더: 타이틀 및 선택 개수 */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          📋 List ({products.length} items)
        </h2>
        {selectedIds.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {products.length}개 중 <span className="font-bold text-primary">{selectedIds.length}개</span> 선택
          </span>
        )}
      </div>

      {/* 테이블 (반응형 스크롤) */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="border-b">
              {/* 전체 선택 체크박스 */}
              <th className="p-3 text-left w-12">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                  aria-label="전체 선택"
                />
              </th>
              {/* 이미지 */}
              <th className="p-3 text-left w-24">이미지</th>
              {/* 상품명 */}
              <th className="p-3 text-left min-w-[300px]">상품명</th>
              {/* 카테고리 (v2 전용) */}
              {version === 'v2' && (
                <th className="p-3 text-left w-32">카테고리</th>
              )}
              {/* 브랜드 (v2 전용) */}
              {version === 'v2' && (
                <th className="p-3 text-left w-32">브랜드</th>
              )}
              {/* ASIN */}
              <th className="p-3 text-left w-32">ASIN</th>
              {/* 리뷰수/평점 (v2 전용) */}
              {version === 'v2' && (
                <th className="p-3 text-center w-32">리뷰/평점</th>
              )}
              {/* 무게 (v2 전용) */}
              {version === 'v2' && (
                <th className="p-3 text-right w-24">무게 (kg)</th>
              )}
              {/* 옵션 (v2 전용) */}
              {version === 'v2' && (
                <th className="p-3 text-left w-32">옵션</th>
              )}
              {/* 아마존 가격 */}
              <th className="p-3 text-right w-28">아마존 가격</th>
              {/* 마진율 */}
              <th className="p-3 text-center w-24">마진율 (%)</th>
              {/* 판매가 */}
              <th className="p-3 text-right w-28">판매가</th>
              {/* 상태 */}
              <th className="p-3 text-center w-24">상태</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr
                key={product.id}
                className="border-b hover:bg-muted/30 transition-colors"
              >
                {/* 체크박스 */}
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(product.id)}
                    onChange={() => handleSelectOne(product.id)}
                    className="w-4 h-4 cursor-pointer"
                    aria-label={`${product.title} 선택`}
                  />
                </td>

                {/* 이미지 (클릭 시 아마존 원본 페이지 이동) */}
                <td className="p-3">
                  {product.images[0] ? (
                    <div
                      onClick={() => handleImageClick(product.sourceUrl)}
                      className="relative w-16 h-16 cursor-pointer hover:opacity-75 transition-opacity"
                      title="클릭하여 아마존 원본 페이지 열기"
                    >
                      <Image
                        src={product.images[0]}
                        alt={product.title}
                        fill
                        className="object-cover rounded-none"
                        sizes="64px"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded-none flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">
                        No Image
                      </span>
                    </div>
                  )}
                </td>

                {/* 상품명 */}
                <td className="p-3">
                  <p className="text-sm line-clamp-2" title={product.title}>
                    {product.title}
                  </p>
                </td>

                {/* 카테고리 (v2 전용) */}
                {version === 'v2' && (
                  <td className="p-3">
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-none">
                      {product.category || 'N/A'}
                    </span>
                  </td>
                )}

                {/* 브랜드 (v2 전용) */}
                {version === 'v2' && (
                  <td className="p-3">
                    <span className="text-sm text-muted-foreground">
                      {product.brand || '-'}
                    </span>
                  </td>
                )}

                {/* ASIN */}
                <td className="p-3">
                  <code className="text-xs bg-muted px-2 py-1 rounded-none">
                    {product.asin}
                  </code>
                </td>

                {/* 리뷰수/평점 (v2 전용) */}
                {version === 'v2' && (
                  <td className="p-3 text-center">
                    {(product.reviewCount != null || product.rating != null) ? (
                      <div className="flex flex-col items-center gap-1">
                        {product.reviewCount != null && (
                          <span className="text-xs text-muted-foreground">
                            리뷰 {Number(product.reviewCount).toLocaleString()}개
                          </span>
                        )}
                        {product.rating != null && (
                          <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                            ⭐ {Number(product.rating).toFixed(1)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                )}

                {/* 무게 (v2 전용) */}
                {version === 'v2' && (
                  <td className="p-3 text-right">
                    {product.weight != null ? (
                      <span className="text-sm font-mono">
                        {Number(product.weight).toFixed(3)} kg
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                )}

                {/* 옵션 (v2 전용) */}
                {version === 'v2' && (
                  <td className="p-3">
                    {product.variants && Array.isArray(product.variants) && product.variants.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {product.variants.map((variant, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded-none whitespace-nowrap"
                          >
                            {variant}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                )}

                {/* 아마존 가격 */}
                <td className="p-3 text-right">
                  <span className="font-mono text-sm">
                    ${product.amazonPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </td>

                {/* 마진율 (입력 가능) */}
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={localMargins[product.id] || product.marginRate}
                      onChange={(e) =>
                        handleMarginChange(product.id, product, e.target.value)
                      }
                      onBlur={(e) =>
                        handleMarginBlur(product.id, parseFloat(e.target.value))
                      }
                      className="w-16 px-2 py-1 text-sm text-center border rounded-none focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={`${product.title} 마진율`}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </td>

                {/* 판매가 (실시간 계산) */}
                <td className="p-3 text-right">
                  <span className="font-mono text-sm font-semibold text-green-600 dark:text-green-400">
                    ${(localPrices[product.id] || product.sellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </td>

                {/* 상태 */}
                <td className="p-3 text-center">
                  <StatusBadge status={product.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="p-8 text-center text-muted-foreground">
          <p className="text-sm">상품 목록을 불러오는 중...</p>
        </div>
      )}
    </div>
  );
}
