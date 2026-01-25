/**
 * @file app/dashboard-v2/editor/page.tsx
 * @description Editor 페이지 (v1.1 고도화)
 * 
 * 상품 상세 편집 및 가격 설정 페이지
 * - 이미지 갤러리 슬라이더
 * - 상품명/설명 편집
 * - 가격 설정 (US/CN 타입 선택)
 * - 옵션 확인
 * - Shopify 등록
 * - productId가 없어도 더미 데이터로 표시
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { ArrowLeft, Save, Upload, ExternalLink, ImageIcon } from 'lucide-react';
import type { ApiResponse, Product } from '@/types';
import { calculatePrice } from '@/lib/pricing/calculator';

// 더미 상품 데이터 (productId가 없을 때 사용)
const DUMMY_PRODUCT: Product = {
  id: 'demo-product-001',
  userId: 'demo-user',
  asin: 'B08XYZ1234',
  sourceUrl: 'https://amazon.com/dp/B08XYZ1234',
  title: 'Sample Product - Phone Stand Holder',
  description: 'Premium phone stand with adjustable angle. Perfect for desk setup and video calls. Compatible with all smartphones.',
  images: [
    'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=500',
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
  ],
  variants: ['Black', 'White', 'Silver'],
  category: 'Electronics',
  reviewCount: 1250,
  rating: 4.5,
  brand: 'TechBrand',
  weight: 0.5,
  sourcingType: 'US',
  amazonPrice: 29.99,
  costPrice: 0,
  shippingCost: 5,
  extraCost: 2,
  marginRate: 40,
  sellingPrice: 41.99,
  status: 'draft',
  errorMessage: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function EditorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get('id');

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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
  const [isActive, setIsActive] = useState(true);

  // 상품 데이터 로드
  useEffect(() => {
    if (!productId) {
      // productId가 없으면 더미 데이터 사용
      setProduct(DUMMY_PRODUCT);
      setTitle(DUMMY_PRODUCT.title);
      setDescription(DUMMY_PRODUCT.description || '');
      setSourcingType(DUMMY_PRODUCT.sourcingType);
      setAmazonPrice(Number(DUMMY_PRODUCT.amazonPrice));
      setCostPrice(Number(DUMMY_PRODUCT.costPrice || 0));
      setShippingCost(Number(DUMMY_PRODUCT.shippingCost || 5));
      setExtraCost(Number(DUMMY_PRODUCT.extraCost || 2));
      setMarginRate(Number(DUMMY_PRODUCT.marginRate));
      setSellingPrice(Number(DUMMY_PRODUCT.sellingPrice));
      setIsLoading(false);
      return;
    }

    fetchProduct();
  }, [productId]);

  // 가격 재계산
  useEffect(() => {
    try {
      const result = calculatePrice({
        sourcingType,
        amazonPrice: sourcingType === 'US' ? amazonPrice : undefined,
        costPrice: sourcingType === 'CN' ? costPrice : undefined,
        shippingCost: sourcingType === 'CN' ? shippingCost : undefined,
        extraCost: sourcingType === 'CN' ? extraCost : undefined,
        marginRate,
      });

      if (result.success) {
        setSellingPrice(result.sellingPrice);
      }
    } catch (err) {
      console.error('가격 계산 오류:', err);
    }
  }, [sourcingType, amazonPrice, costPrice, shippingCost, extraCost, marginRate]);

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
    setIsSaving(true);
    setSaveMessage(null);

    try {
      if (!productId) {
        // 더미 모드: 로컬 스토리지에 저장
        const savedData = {
          title,
          description,
          sourcingType,
          amazonPrice,
          costPrice,
          shippingCost,
          extraCost,
          marginRate,
          sellingPrice,
        };
        localStorage.setItem('editor_draft', JSON.stringify(savedData));
        setSaveMessage('Product information saved (demo mode).');
        setTimeout(() => setSaveMessage(null), 3000);
        setIsSaving(false);
        return;
      }

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

  const handleUploadToShopify = async () => {
    if (!productId) {
      setSaveMessage('Demo mode: Upload simulation (would upload to Shopify in production).');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsUploading(true);
    setSaveMessage(null);

    try {
      // 먼저 저장
      await handleSave();

      // Shopify 업로드 API 호출
      const response = await fetch('/api/shopify/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds: [productId],
          active: isActive,
        }),
      });

      const data: ApiResponse = await response.json();

      if (response.ok && data.success) {
        setSaveMessage('Product uploaded to Shopify successfully.');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setError(data.error || 'Failed to upload to Shopify.');
      }
    } catch (err) {
      console.error('업로드 오류:', err);
      setError('An error occurred while uploading.');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Loading product...</p>
            <div className="animate-pulse">
              <div className="h-4 bg-muted w-48 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentProduct = product || DUMMY_PRODUCT;
  const images = currentProduct.images || [];
  const currentImage = images[selectedImageIndex] || images[0] || '';

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.push('/dashboard-v2/products')}
            variant="ghost"
            size="icon"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold mb-2">Product Editor</h1>
            <p className="text-muted-foreground">{currentProduct.asin}</p>
          </div>
        </div>
        {currentProduct.sourceUrl && (
          <Button
            variant="outline"
            onClick={() => window.open(currentProduct.sourceUrl, '_blank')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View on Amazon
          </Button>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-none">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 아마존 콘텐츠 */}
        <div className="space-y-6">
          {/* 이미지 갤러리 */}
          <div className="p-6 bg-card rounded-none border">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Image Gallery
            </h2>
            {images.length > 0 ? (
              <div className="space-y-4">
                <div className="relative aspect-square w-full bg-muted rounded-none overflow-hidden border">
                  {currentImage ? (
                    <Image
                      src={currentImage}
                      alt={title}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`relative aspect-square bg-muted rounded-none overflow-hidden border-2 transition-colors ${
                          selectedImageIndex === idx
                            ? 'border-primary'
                            : 'border-transparent hover:border-muted-foreground'
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
                <p className="text-xs text-muted-foreground text-center">
                  {images.length} image{images.length !== 1 ? 's' : ''} available
                </p>
              </div>
            ) : (
              <div className="p-8 bg-muted rounded-none text-center">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No images available.</p>
              </div>
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
              placeholder="Enter product title..."
            />
            {currentProduct.brand && (
              <p className="text-xs text-muted-foreground mt-1">
                Brand: {currentProduct.brand}
              </p>
            )}
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
            <p className="text-xs text-muted-foreground mt-1">
              {description.length} characters
            </p>
          </div>

          {/* 상품 정보 */}
          <div className="p-6 bg-card rounded-none border">
            <h2 className="text-lg font-semibold mb-4">Product Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">ASIN</p>
                <p className="font-mono font-semibold">{currentProduct.asin}</p>
              </div>
              {currentProduct.category && (
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p className="font-semibold">{currentProduct.category}</p>
                </div>
              )}
              {currentProduct.reviewCount !== null && (
                <div>
                  <p className="text-muted-foreground">Reviews</p>
                  <p className="font-semibold">{currentProduct.reviewCount.toLocaleString()}</p>
                </div>
              )}
              {currentProduct.rating !== null && (
                <div>
                  <p className="text-muted-foreground">Rating</p>
                  <p className="font-semibold">{currentProduct.rating.toFixed(1)} ⭐</p>
                </div>
              )}
            </div>
          </div>

          {/* 옵션 목록 */}
          {currentProduct.variants && (
            <div className="p-6 bg-card rounded-none border">
              <h2 className="text-lg font-semibold mb-4">Variants</h2>
              <div className="space-y-2">
                {Array.isArray(currentProduct.variants) ? (
                  currentProduct.variants.map((variant, idx) => (
                    <div key={idx} className="text-sm p-2 bg-muted rounded-none">
                      {typeof variant === 'string' ? variant : JSON.stringify(variant)}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {JSON.stringify(currentProduct.variants)}
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
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              💰 Price Calculator
            </h2>

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
                <>
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
                  <div>
                    <Label htmlFor="us-shipping">Shipping Cost ($)</Label>
                    <Input
                      id="us-shipping"
                      type="number"
                      min="0"
                      step="0.01"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="us-extra">Extra Cost ($)</Label>
                    <Input
                      id="us-extra"
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
              <div className="p-4 bg-muted rounded-none border-2 border-primary">
                <Label>Final Selling Price</Label>
                <p className="text-3xl font-bold text-primary mt-2">
                  ${sellingPrice.toFixed(2)}
                </p>
                {sourcingType === 'US' && amazonPrice > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Total Cost: ${(amazonPrice + shippingCost + extraCost).toFixed(2)} | Profit: ${(sellingPrice - (amazonPrice + shippingCost + extraCost)).toFixed(2)} ({marginRate}%)
                  </p>
                )}
                {sourcingType === 'CN' && costPrice > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Total Cost: ${(costPrice + shippingCost + extraCost).toFixed(2)} | Profit: ${(sellingPrice - (costPrice + shippingCost + extraCost)).toFixed(2)}
                  </p>
                )}
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
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="active-status">Register as Active on Shopify</Label>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  variant="outline"
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Product'}
                </Button>
                <Button
                  onClick={handleUploadToShopify}
                  disabled={isUploading || isSaving}
                  className="flex-1"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploading ? 'Uploading...' : 'Upload to Shopify'}
                </Button>
              </div>
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
