/**
 * @file app/dashboard-v2/editor/page.tsx
 * @description Editor 페이지 (v1.1)
 * 
 * 상품 상세 편집 및 가격 설정 페이지
 * - 이미지 갤러리 슬라이더
 * - 상품명/설명 편집
 * - 가격 설정 (US/CN 타입 선택)
 * - 옵션 확인
 * - Shopify 등록
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import type { ApiResponse, Product } from '@/types';
import { calculatePrice } from '@/lib/pricing/calculator';

export default function EditorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get('id');

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 편집 상태
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourcingType, setSourcingType] = useState<'US' | 'CN'>('US');
  const [amazonPrice, setAmazonPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(5);
  const [extraCost, setExtraCost] = useState<number>(2);
  const [marginRate, setMarginRate] = useState<number>(40);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // 상품 데이터 로드
  useEffect(() => {
    if (!productId) {
      setError('Product ID is missing.');
      setIsLoading(false);
      return;
    }

    fetchProduct();
  }, [productId]);

  // 가격 재계산
  useEffect(() => {
    if (!product) return;

    try {
      const result = calculatePrice({
        sourcingType,
        amazonPrice: sourcingType === 'US' ? amazonPrice : undefined,
        costPrice: sourcingType === 'CN' ? costPrice : undefined,
        shippingCost: sourcingType === 'CN' ? shippingCost : undefined,
        extraCost: sourcingType === 'CN' ? extraCost : undefined,
        marginRate,
      });

      setSellingPrice(result.sellingPrice);
    } catch (err) {
      console.error('가격 계산 오류:', err);
    }
  }, [sourcingType, amazonPrice, costPrice, shippingCost, extraCost, marginRate, product]);

  const fetchProduct = async () => {
    if (!productId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/products/${productId}`);
      const data: ApiResponse<Product> = await response.json();

      if (response.ok && data.success && data.data) {
        const p = data.data;
        setProduct(p);
        setTitle(p.title);
        setDescription(p.description || '');
        setSourcingType(p.sourcingType);
        setAmazonPrice(Number(p.amazonPrice));
        setCostPrice(Number(p.costPrice || 0));
        setShippingCost(Number(p.shippingCost || 5));
        setExtraCost(Number(p.extraCost || 2));
        setMarginRate(Number(p.marginRate));
        setSellingPrice(Number(p.sellingPrice));
      } else {
        setError(data.error || 'Failed to load product.');
      }
    } catch (err) {
      console.error('상품 로드 오류:', err);
      setError('An error occurred while loading the product.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!productId) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          sourcingType,
          amazonPrice: sourcingType === 'US' ? amazonPrice : undefined,
          costPrice: sourcingType === 'CN' ? costPrice : undefined,
          shippingCost: sourcingType === 'CN' ? shippingCost : undefined,
          extraCost: sourcingType === 'CN' ? extraCost : undefined,
          marginRate,
        }),
      });

      const data: ApiResponse<Product> = await response.json();

      if (response.ok && data.success) {
        setSaveMessage('Product information saved successfully.');
        setTimeout(() => setSaveMessage(null), 3000);
        if (data.data) {
          setProduct(data.data);
        }
      } else {
        setError(data.error || 'Failed to save.');
      }
    } catch (err) {
      console.error('저장 오류:', err);
      setError('An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="p-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-none">
          <p className="text-red-700 dark:text-red-300">{error || 'Product not found.'}</p>
          <Button
            onClick={() => router.push('/dashboard-v2')}
            className="mt-4"
            variant="outline"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
        </div>
      </div>
    );
  }

  const images = product.images || [];
  const currentImage = images[selectedImageIndex] || images[0] || '';

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 헤더 */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          onClick={() => router.push('/dashboard-v2')}
          variant="ghost"
          size="icon"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">Product Editor</h1>
          <p className="text-muted-foreground">{product.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 아마존 콘텐츠 */}
        <div className="space-y-6">
          {/* 이미지 갤러리 */}
          <div className="p-6 bg-card rounded-none border">
            <h2 className="text-lg font-semibold mb-4">Image Gallery</h2>
            {images.length > 0 ? (
              <div className="space-y-4">
                <div className="relative aspect-square w-full bg-muted rounded-none overflow-hidden">
                  {currentImage && (
                    <Image
                      src={currentImage}
                      alt={title}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  )}
                </div>
                {images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`relative aspect-square bg-muted rounded-none overflow-hidden border-2 ${
                          selectedImageIndex === idx
                            ? 'border-primary'
                            : 'border-transparent'
                        }`}
                      >
                        <Image
                          src={img}
                          alt={`${title} ${idx + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No images available.</p>
            )}
          </div>

          {/* 상품명 */}
          <div className="p-6 bg-card rounded-none border">
            <Label htmlFor="title">Product Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* 상세설명 */}
          <div className="p-6 bg-card rounded-none border">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 min-h-[200px]"
              placeholder="Enter product description..."
            />
          </div>

          {/* 옵션 목록 */}
          {product.variants && (
            <div className="p-6 bg-card rounded-none border">
              <h2 className="text-lg font-semibold mb-4">Variants</h2>
              <div className="space-y-2">
                {Array.isArray(product.variants) ? (
                  product.variants.map((variant, idx) => (
                    <div key={idx} className="text-sm text-muted-foreground">
                      - {typeof variant === 'string' ? variant : JSON.stringify(variant)}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {JSON.stringify(product.variants)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 가격/소싱 컨트롤 */}
        <div className="space-y-6">
          {/* 가격 계산기 */}
          <div className="p-6 bg-card rounded-none border">
            <h2 className="text-lg font-semibold mb-4">💰 Price Calculator</h2>

            <div className="space-y-4">
              {/* 소싱 타입 선택 */}
              <div>
                <Label htmlFor="sourcing-type">Sourcing Type</Label>
                <select
                  id="sourcing-type"
                  value={sourcingType}
                  onChange={(e) => setSourcingType(e.target.value as 'US' | 'CN')}
                  className="mt-2 w-full px-3 py-2 border border-input bg-background rounded-none text-sm"
                >
                  <option value="US">US (Amazon price-based)</option>
                  <option value="CN">CN (Taobao cost-based)</option>
                </select>
              </div>

              {/* US 타입 입력 */}
              {sourcingType === 'US' && (
                <div>
                  <Label htmlFor="amazon-price">Amazon Price ($)</Label>
                  <Input
                    id="amazon-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amazonPrice}
                    onChange={(e) => setAmazonPrice(parseFloat(e.target.value) || 0)}
                    className="mt-2"
                  />
                </div>
              )}

              {/* CN 타입 입력 */}
              {sourcingType === 'CN' && (
                <>
                  <div>
                    <Label htmlFor="cost-price">Cost Price ($)</Label>
                    <Input
                      id="cost-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={costPrice}
                      onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipping">Shipping Cost ($)</Label>
                    <Input
                      id="shipping"
                      type="number"
                      min="0"
                      step="0.01"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="extra">Extra Cost ($)</Label>
                    <Input
                      id="extra"
                      type="number"
                      min="0"
                      step="0.01"
                      value={extraCost}
                      onChange={(e) => setExtraCost(parseFloat(e.target.value) || 0)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Duties, platform fees, etc.
                    </p>
                  </div>
                </>
              )}

              {/* 마진율 */}
              <div>
                <Label htmlFor="margin">Margin Rate (%)</Label>
                <Input
                  id="margin"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={marginRate}
                  onChange={(e) => setMarginRate(parseFloat(e.target.value) || 0)}
                  className="mt-2"
                />
              </div>

              {/* 최종 판매가 */}
              <div className="p-4 bg-muted rounded-none">
                <Label>Final Selling Price</Label>
                <p className="text-2xl font-bold text-primary mt-2">
                  ${sellingPrice.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* 등록 설정 */}
          <div className="p-6 bg-card rounded-none border">
            <h2 className="text-lg font-semibold mb-4">⚙️ Registration Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active-status"
                  defaultChecked
                  className="w-4 h-4"
                />
                <Label htmlFor="active-status">Register as Active on Shopify</Label>
              </div>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? 'Saving...' : 'Save Product'}
              </Button>
            </div>
          </div>

          {/* 저장 메시지 */}
          {saveMessage && (
            <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-none">
              <p className="text-sm text-green-700 dark:text-green-300">
                ✅ {saveMessage}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
