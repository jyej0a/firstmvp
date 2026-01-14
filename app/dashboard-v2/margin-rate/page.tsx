/**
 * @file app/dashboard-v2/margin-rate/page.tsx
 * @description Margin Rate 페이지 (v1.1)
 * 
 * 전역 마진율 관리 및 설정 페이지
 * - US/CN 타입별 기본 마진율 설정
 * - 가격 계산 공식 표시
 * - 기본 마진율 저장/불러오기
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULT_US_MARGIN = 30;
const DEFAULT_CN_MARGIN = 30;
const DEFAULT_SHIPPING = 5;
const DEFAULT_EXTRA = 2;

export default function MarginRatePage() {
  const [usMargin, setUsMargin] = useState<number>(DEFAULT_US_MARGIN);
  const [cnMargin, setCnMargin] = useState<number>(DEFAULT_CN_MARGIN);
  const [shippingCost, setShippingCost] = useState<number>(DEFAULT_SHIPPING);
  const [extraCost, setExtraCost] = useState<number>(DEFAULT_EXTRA);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 로컬 스토리지에서 설정 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUsMargin = localStorage.getItem('default_us_margin');
      const savedCnMargin = localStorage.getItem('default_cn_margin');
      const savedShipping = localStorage.getItem('default_shipping_cost');
      const savedExtra = localStorage.getItem('default_extra_cost');

      if (savedUsMargin) setUsMargin(parseFloat(savedUsMargin));
      if (savedCnMargin) setCnMargin(parseFloat(savedCnMargin));
      if (savedShipping) setShippingCost(parseFloat(savedShipping));
      if (savedExtra) setExtraCost(parseFloat(savedExtra));
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
        localStorage.setItem('default_shipping_cost', shippingCost.toString());
        localStorage.setItem('default_extra_cost', extraCost.toString());
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

  // 예시 계산 (US 타입)
  const exampleUsPrice = 100;
  const calculatedUsPrice = exampleUsPrice * (1 + usMargin / 100);

  // 예시 계산 (CN 타입)
  const exampleCost = 10;
  const calculatedCnPrice = (exampleCost + shippingCost + extraCost) / (1 - cnMargin / 100);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Margin Rate</h1>
        <p className="text-muted-foreground">
          Global margin rate management & settings
        </p>
      </div>

      {/* US 타입 마진율 설정 */}
      <div className="mb-6 p-6 bg-card rounded-none border">
        <h2 className="text-xl font-semibold mb-4">US Type Default Margin</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Amazon price-based margin rate settings
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="us-margin">Default Margin Rate (%)</Label>
            <Input
              id="us-margin"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={usMargin}
              onChange={(e) => setUsMargin(parseFloat(e.target.value) || 0)}
              className="mt-2"
            />
          </div>

          <div className="p-4 bg-muted rounded-none">
            <p className="text-sm font-semibold mb-2">Price Calculation Formula</p>
            <p className="text-sm text-muted-foreground">
              Selling Price = Amazon Price × (1 + Margin Rate / 100)
            </p>
            <div className="mt-3 p-3 bg-background rounded-none">
              <p className="text-sm">
                Example: Amazon Price ${exampleUsPrice.toFixed(2)} × (1 + {usMargin}% / 100) ={' '}
                <span className="font-bold text-primary">
                  ${calculatedUsPrice.toFixed(2)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CN 타입 마진율 설정 */}
      <div className="mb-6 p-6 bg-card rounded-none border">
        <h2 className="text-xl font-semibold mb-4">CN Type Default Margin</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Taobao cost-based margin rate settings
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="cn-margin">Default Margin Rate (%)</Label>
            <Input
              id="cn-margin"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={cnMargin}
              onChange={(e) => setCnMargin(parseFloat(e.target.value) || 0)}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="shipping">Default Shipping Cost ($)</Label>
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
            <Label htmlFor="extra">Default Extra Cost ($)</Label>
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
              Additional costs (duties, platform fees, etc.)
            </p>
          </div>

          <div className="p-4 bg-muted rounded-none">
            <p className="text-sm font-semibold mb-2">Price Calculation Formula</p>
            <p className="text-sm text-muted-foreground">
              Selling Price = (Cost + Shipping + Extra) / (1 - Margin Rate / 100)
            </p>
            <div className="mt-3 p-3 bg-background rounded-none">
              <p className="text-sm">
                Example: (${exampleCost.toFixed(2)} + ${shippingCost.toFixed(2)} + ${extraCost.toFixed(2)}) / (1 - {cnMargin}% / 100) ={' '}
                <span className="font-bold text-primary">
                  ${calculatedCnPrice.toFixed(2)}
                </span>
              </p>
            </div>
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
