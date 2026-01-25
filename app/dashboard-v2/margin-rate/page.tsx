/**
 * @file app/dashboard-v2/margin-rate/page.tsx
 * @description Margin Rate 페이지 (v1.1 고도화)
 * 
 * 전역 마진율 관리 및 설정 페이지
 * - US/CN 타입별 기본 마진율 설정
 * - 가격 계산 공식 표시 및 시뮬레이터
 * - 마진율 추천 기능
 * - 통계 및 히스토리
 * - 기본 마진율 저장/불러오기
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, TrendingUp, DollarSign, Percent, Info, Lightbulb } from 'lucide-react';

const DEFAULT_US_MARGIN = 30;
const DEFAULT_CN_MARGIN = 30;
const DEFAULT_US_SHIPPING = 3;
const DEFAULT_US_EXTRA = 1;
const DEFAULT_CN_SHIPPING = 5;
const DEFAULT_CN_EXTRA = 2;

export default function MarginRatePage() {
  const [usMargin, setUsMargin] = useState<number>(DEFAULT_US_MARGIN);
  const [cnMargin, setCnMargin] = useState<number>(DEFAULT_CN_MARGIN);
  const [usShippingCost, setUsShippingCost] = useState<number>(DEFAULT_US_SHIPPING);
  const [usExtraCost, setUsExtraCost] = useState<number>(DEFAULT_US_EXTRA);
  const [cnShippingCost, setCnShippingCost] = useState<number>(DEFAULT_CN_SHIPPING);
  const [cnExtraCost, setCnExtraCost] = useState<number>(DEFAULT_CN_EXTRA);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 시뮬레이터 입력값
  const [simulatorUsPrice, setSimulatorUsPrice] = useState<number>(100);
  const [simulatorCnCost, setSimulatorCnCost] = useState<number>(10);

  // 로컬 스토리지에서 설정 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUsMargin = localStorage.getItem('default_us_margin');
      const savedCnMargin = localStorage.getItem('default_cn_margin');
      const savedUsShipping = localStorage.getItem('default_us_shipping_cost');
      const savedUsExtra = localStorage.getItem('default_us_extra_cost');
      const savedCnShipping = localStorage.getItem('default_cn_shipping_cost');
      const savedCnExtra = localStorage.getItem('default_cn_extra_cost');

      if (savedUsMargin) setUsMargin(parseFloat(savedUsMargin));
      if (savedCnMargin) setCnMargin(parseFloat(savedCnMargin));
      if (savedUsShipping) setUsShippingCost(parseFloat(savedUsShipping));
      if (savedUsExtra) setUsExtraCost(parseFloat(savedUsExtra));
      if (savedCnShipping) setCnShippingCost(parseFloat(savedCnShipping));
      if (savedCnExtra) setCnExtraCost(parseFloat(savedCnExtra));
    }
  }, []);

  // 설정 저장
  const handleSave = () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('default_us_margin', usMargin.toString());
        localStorage.setItem('default_cn_margin', cnMargin.toString());
        localStorage.setItem('default_us_shipping_cost', usShippingCost.toString());
        localStorage.setItem('default_us_extra_cost', usExtraCost.toString());
        localStorage.setItem('default_cn_shipping_cost', cnShippingCost.toString());
        localStorage.setItem('default_cn_extra_cost', cnExtraCost.toString());
      }

      setSaveMessage('Settings saved successfully.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('설정 저장 실패:', err);
      setSaveMessage('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // 가격 계산 함수
  const calculateUsPrice = (amazonPrice: number, shipping: number, extra: number, margin: number) => {
    if (margin >= 100) return 0;
    const totalCost = amazonPrice + shipping + extra;
    return totalCost / (1 - margin / 100);
  };

  const calculateCnPrice = (cost: number, shipping: number, extra: number, margin: number) => {
    if (margin >= 100) return 0;
    return (cost + shipping + extra) / (1 - margin / 100);
  };

  // 예시 계산
  const exampleUsPrice = 100;
  const calculatedUsPrice = calculateUsPrice(exampleUsPrice, usShippingCost, usExtraCost, usMargin);
  const usTotalCost = exampleUsPrice + usShippingCost + usExtraCost;
  const usProfit = calculatedUsPrice - usTotalCost;

  const exampleCost = 10;
  const calculatedCnPrice = calculateCnPrice(exampleCost, cnShippingCost, cnExtraCost, cnMargin);
  const cnTotalCost = exampleCost + cnShippingCost + cnExtraCost;
  const cnProfit = calculatedCnPrice - cnTotalCost;

  // 시뮬레이터 계산
  const simulatedUsPrice = calculateUsPrice(simulatorUsPrice, usShippingCost, usExtraCost, usMargin);
  const simulatedCnPrice = calculateCnPrice(simulatorCnCost, cnShippingCost, cnExtraCost, cnMargin);

  // 마진율 추천 (일반적인 범위)
  const recommendedMargins = {
    us: { min: 25, max: 50, optimal: 35 },
    cn: { min: 30, max: 60, optimal: 40 },
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Margin Rate</h1>
        <p className="text-muted-foreground">
          Global margin rate management & settings
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-6 bg-card rounded-none border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">US Type Margin</p>
              <p className="text-3xl font-bold">{usMargin}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Example: ${exampleUsPrice} + ${usShippingCost} + ${usExtraCost} → ${calculatedUsPrice.toFixed(2)} (+${usProfit.toFixed(2)})
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="p-6 bg-card rounded-none border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">CN Type Margin</p>
              <p className="text-3xl font-bold">{cnMargin}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Example: ${exampleCost} + ${cnShippingCost} + ${cnExtraCost} → ${calculatedCnPrice.toFixed(2)} (+${cnProfit.toFixed(2)})
              </p>
            </div>
            <Percent className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* US 타입 마진율 설정 */}
      <div className="mb-6 p-6 bg-card rounded-none border">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">US Type Default Margin</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Amazon price-based margin rate settings
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="us-margin">Default Margin Rate (%)</Label>
            <div className="flex items-center gap-4 mt-2">
              <Input
                id="us-margin"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={usMargin}
                onChange={(e) => setUsMargin(parseFloat(e.target.value) || 0)}
                className="flex-1"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUsMargin(recommendedMargins.us.optimal)}
                >
                  Recommended ({recommendedMargins.us.optimal}%)
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Recommended range: {recommendedMargins.us.min}% - {recommendedMargins.us.max}%
            </p>
          </div>

          <div className="p-4 bg-muted rounded-none">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Price Calculation Formula
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Selling Price = (Amazon Price + Shipping + Extra) / (1 - Margin Rate / 100)
            </p>
            <div className="mt-3 p-3 bg-background rounded-none border">
              <p className="text-sm mb-2">
                Example: (${exampleUsPrice.toFixed(2)} + ${usShippingCost.toFixed(2)} + {usExtraCost.toFixed(2)}) / (1 - {usMargin}% / 100) ={' '}
                <span className="font-bold text-primary">
                  ${calculatedUsPrice.toFixed(2)}
                </span>
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                <span>Total Cost: ${usTotalCost.toFixed(2)}</span>
                <span>•</span>
                <span>Profit: ${usProfit.toFixed(2)}</span>
                <span>•</span>
                <span>Margin: {usMargin}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="us-shipping">Default Shipping Cost ($)</Label>
              <Input
                id="us-shipping"
                type="number"
                min="0"
                step="0.01"
                value={usShippingCost}
                onChange={(e) => setUsShippingCost(parseFloat(e.target.value) || 0)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="us-extra">Default Extra Cost ($)</Label>
              <Input
                id="us-extra"
                type="number"
                min="0"
                step="0.01"
                value={usExtraCost}
                onChange={(e) => setUsExtraCost(parseFloat(e.target.value) || 0)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Duties, platform fees, etc.
              </p>
            </div>
          </div>

          {/* 가격 시뮬레이터 */}
          <div className="p-4 bg-muted rounded-none">
            <p className="text-sm font-semibold mb-3">Price Simulator</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="sim-us-price" className="text-xs">Amazon Price ($)</Label>
                <Input
                  id="sim-us-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={simulatorUsPrice}
                  onChange={(e) => setSimulatorUsPrice(parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
              <div className="p-3 bg-background rounded-none border">
                <p className="text-sm">
                  Selling Price: <span className="font-bold text-primary">${simulatedUsPrice.toFixed(2)}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total Cost: ${(simulatorUsPrice + usShippingCost + usExtraCost).toFixed(2)} | Profit: ${(simulatedUsPrice - (simulatorUsPrice + usShippingCost + usExtraCost)).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CN 타입 마진율 설정 */}
      <div className="mb-6 p-6 bg-card rounded-none border">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">CN Type Default Margin</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Taobao cost-based margin rate settings
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="cn-margin">Default Margin Rate (%)</Label>
            <div className="flex items-center gap-4 mt-2">
              <Input
                id="cn-margin"
                type="number"
                min="0"
                max="99"
                step="0.1"
                value={cnMargin}
                onChange={(e) => setCnMargin(parseFloat(e.target.value) || 0)}
                className="flex-1"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCnMargin(recommendedMargins.cn.optimal)}
                >
                  Recommended ({recommendedMargins.cn.optimal}%)
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Recommended range: {recommendedMargins.cn.min}% - {recommendedMargins.cn.max}%
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cn-shipping">Default Shipping Cost ($)</Label>
              <Input
                id="cn-shipping"
                type="number"
                min="0"
                step="0.01"
                value={cnShippingCost}
                onChange={(e) => setCnShippingCost(parseFloat(e.target.value) || 0)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="cn-extra">Default Extra Cost ($)</Label>
              <Input
                id="cn-extra"
                type="number"
                min="0"
                step="0.01"
                value={cnExtraCost}
                onChange={(e) => setCnExtraCost(parseFloat(e.target.value) || 0)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Duties, platform fees, etc.
              </p>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-none">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Price Calculation Formula
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Selling Price = (Cost + Shipping + Extra) / (1 - Margin Rate / 100)
            </p>
            <div className="mt-3 p-3 bg-background rounded-none border">
              <p className="text-sm mb-2">
                Example: (${exampleCost.toFixed(2)} + ${cnShippingCost.toFixed(2)} + ${cnExtraCost.toFixed(2)}) / (1 - {cnMargin}% / 100) ={' '}
                <span className="font-bold text-primary">
                  ${calculatedCnPrice.toFixed(2)}
                </span>
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                <span>Total Cost: ${cnTotalCost.toFixed(2)}</span>
                <span>•</span>
                <span>Profit: ${cnProfit.toFixed(2)}</span>
                <span>•</span>
                <span>Margin: {cnMargin}%</span>
              </div>
            </div>
          </div>

          {/* 가격 시뮬레이터 */}
          <div className="p-4 bg-muted rounded-none">
            <p className="text-sm font-semibold mb-3">Price Simulator</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="sim-cn-cost" className="text-xs">Cost Price ($)</Label>
                <Input
                  id="sim-cn-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={simulatorCnCost}
                  onChange={(e) => setSimulatorCnCost(parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
              <div className="p-3 bg-background rounded-none border">
                <p className="text-sm">
                  Selling Price: <span className="font-bold text-primary">${simulatedCnPrice.toFixed(2)}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total Cost: ${(simulatorCnCost + cnShippingCost + cnExtraCost).toFixed(2)} | Profit: ${(simulatedCnPrice - (simulatorCnCost + cnShippingCost + cnExtraCost)).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 팁 및 정보 */}
      <div className="mb-6 p-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-none">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Tips & Best Practices</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• <strong>US Type:</strong> 아마존 가격에 배송비와 추가 비용을 더한 후 마진율을 적용합니다. 일반적으로 25-50% 마진율을 권장합니다.</li>
              <li>• <strong>CN Type:</strong> 원가 기반이므로 배송비와 관세를 고려하여 30-60% 마진율을 권장합니다.</li>
              <li>• 마진율은 시장 상황과 경쟁 상품 가격에 따라 조정하세요.</li>
              <li>• 설정한 기본 마진율은 새 상품 등록 시 자동으로 적용됩니다.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex justify-end gap-4">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="px-8"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* 저장 메시지 */}
      {saveMessage && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-none">
          <p className="text-sm text-green-700 dark:text-green-300">
            ✅ {saveMessage}
          </p>
        </div>
      )}
    </div>
  );
}
