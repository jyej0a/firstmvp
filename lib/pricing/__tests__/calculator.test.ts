/**
 * @file lib/pricing/__tests__/calculator.test.ts
 * @description 가격 계산 모듈 단위 테스트
 *
 * 테스트 범위:
 * 1. calculateSellingPriceUS() - US 타입 판매가 계산
 * 2. validatePriceData() - 가격 데이터 유효성 검증
 * 3. calculatePrice() - 통합 가격 계산 함수
 * 4. calculateMarginRate() - 마진율 역계산
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSellingPriceUS,
  validatePriceData,
  calculatePrice,
  calculateMarginRate,
} from '../calculator';

describe('calculateSellingPriceUS', () => {
  describe('정상 케이스', () => {
    it('40% 마진율로 정확히 계산해야 함', () => {
      const result = calculateSellingPriceUS(29.99, 40);
      expect(result).toBe(41.99);
    });

    it('50% 마진율로 정확히 계산해야 함', () => {
      const result = calculateSellingPriceUS(100, 50);
      expect(result).toBe(150);
    });

    it('10% 마진율로 정확히 계산해야 함', () => {
      const result = calculateSellingPriceUS(50, 10);
      expect(result).toBe(55);
    });

    it('소수점 둘째 자리까지 반올림해야 함', () => {
      const result = calculateSellingPriceUS(33.33, 33.33);
      expect(result).toBe(44.44); // 33.33 × 1.3333 = 44.43889 → 반올림 44.44
    });
  });

  describe('경계값 테스트', () => {
    it('0% 마진율일 때 원래 가격과 동일해야 함', () => {
      const result = calculateSellingPriceUS(100, 0);
      expect(result).toBe(100);
    });

    it('100% 마진율일 때 2배가 되어야 함', () => {
      const result = calculateSellingPriceUS(50, 100);
      expect(result).toBe(100);
    });

    it('매우 작은 가격도 정확히 계산해야 함', () => {
      const result = calculateSellingPriceUS(0.01, 40);
      expect(result).toBe(0.01); // 0.01 × 1.4 = 0.014 → 반올림 0.01
    });
  });

  describe('에러 케이스', () => {
    it('음수 가격은 에러를 발생시켜야 함', () => {
      expect(() => calculateSellingPriceUS(-10, 40)).toThrow(
        '아마존 가격은 0보다 커야 합니다.'
      );
    });

    it('0 가격은 에러를 발생시켜야 함', () => {
      expect(() => calculateSellingPriceUS(0, 40)).toThrow(
        '아마존 가격은 0보다 커야 합니다.'
      );
    });

    it('음수 마진율은 에러를 발생시켜야 함', () => {
      expect(() => calculateSellingPriceUS(100, -10)).toThrow(
        '마진율은 0%에서 100% 사이여야 합니다.'
      );
    });

    it('100% 초과 마진율은 에러를 발생시켜야 함', () => {
      expect(() => calculateSellingPriceUS(100, 150)).toThrow(
        '마진율은 0%에서 100% 사이여야 합니다.'
      );
    });
  });
});

describe('validatePriceData', () => {
  describe('US 타입 유효성 검증', () => {
    it('유효한 US 타입 데이터는 통과해야 함', () => {
      const result = validatePriceData({
        sourcingType: 'US',
        amazonPrice: 29.99,
        marginRate: 40,
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('amazonPrice가 없으면 에러를 반환해야 함', () => {
      const result = validatePriceData({
        sourcingType: 'US',
        marginRate: 40,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('아마존 가격은 0보다 커야 합니다.');
    });

    it('amazonPrice가 0 이하면 에러를 반환해야 함', () => {
      const result = validatePriceData({
        sourcingType: 'US',
        amazonPrice: -10,
        marginRate: 40,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('아마존 가격은 0보다 커야 합니다.');
    });
  });

  describe('CN 타입 유효성 검증', () => {
    it('유효한 CN 타입 데이터는 통과해야 함', () => {
      const result = validatePriceData({
        sourcingType: 'CN',
        costPrice: 10,
        shippingCost: 5,
        extraCost: 2,
        marginRate: 40,
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('costPrice가 없으면 에러를 반환해야 함', () => {
      const result = validatePriceData({
        sourcingType: 'CN',
        marginRate: 40,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('원가는 0보다 커야 합니다.');
    });

    it('음수 배송비는 에러를 반환해야 함', () => {
      const result = validatePriceData({
        sourcingType: 'CN',
        costPrice: 10,
        shippingCost: -5,
        marginRate: 40,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('배송비는 0 이상이어야 합니다.');
    });

    it('음수 추가 비용은 에러를 반환해야 함', () => {
      const result = validatePriceData({
        sourcingType: 'CN',
        costPrice: 10,
        extraCost: -2,
        marginRate: 40,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('추가 비용은 0 이상이어야 합니다.');
    });
  });

  describe('마진율 유효성 검증', () => {
    it('음수 마진율은 에러를 반환해야 함', () => {
      const result = validatePriceData({
        sourcingType: 'US',
        amazonPrice: 100,
        marginRate: -10,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('마진율은 0%에서 100% 사이여야 합니다.');
    });

    it('100% 초과 마진율은 에러를 반환해야 함', () => {
      const result = validatePriceData({
        sourcingType: 'US',
        amazonPrice: 100,
        marginRate: 150,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('마진율은 0%에서 100% 사이여야 합니다.');
    });
  });
});

describe('calculatePrice', () => {
  describe('US 타입 통합 계산', () => {
    it('유효한 US 타입 데이터로 성공적으로 계산해야 함', () => {
      const result = calculatePrice({
        sourcingType: 'US',
        amazonPrice: 29.99,
        marginRate: 40,
      });

      expect(result.success).toBe(true);
      expect(result.sellingPrice).toBe(41.99);
      expect(result.marginRate).toBe(40);
      expect(result.error).toBeUndefined();
    });

    it('잘못된 데이터는 실패를 반환해야 함', () => {
      const result = calculatePrice({
        sourcingType: 'US',
        amazonPrice: -10,
        marginRate: 40,
      });

      expect(result.success).toBe(false);
      expect(result.sellingPrice).toBe(0);
      expect(result.error).toBe('아마존 가격은 0보다 커야 합니다.');
    });

    it('amazonPrice가 없으면 실패를 반환해야 함', () => {
      const result = calculatePrice({
        sourcingType: 'US',
        marginRate: 40,
      });

      expect(result.success).toBe(false);
      expect(result.sellingPrice).toBe(0);
      expect(result.error).toBeDefined();
    });
  });

  describe('CN 타입 통합 계산', () => {
    it('유효한 CN 타입 데이터로 성공적으로 계산해야 함', () => {
      const result = calculatePrice({
        sourcingType: 'CN',
        costPrice: 3.0,
        shippingCost: 2.0,
        extraCost: 1.0,
        marginRate: 40,
      });

      expect(result.success).toBe(true);
      expect(result.sellingPrice).toBe(10.0); // (3 + 2 + 1) / (1 - 0.4) = 10
      expect(result.marginRate).toBe(40);
      expect(result.error).toBeUndefined();
    });

    it('costPrice가 없으면 실패를 반환해야 함', () => {
      const result = calculatePrice({
        sourcingType: 'CN',
        marginRate: 40,
      });

      expect(result.success).toBe(false);
      expect(result.sellingPrice).toBe(0);
      expect(result.error).toBeDefined();
    });
  });
});

describe('calculateMarginRate', () => {
  describe('정상 케이스', () => {
    it('판매가와 아마존 가격으로 마진율을 역계산해야 함', () => {
      const result = calculateMarginRate(41.99, 29.99);
      expect(result).toBe(40.01); // ((41.99 / 29.99) - 1) × 100
    });

    it('2배 판매가는 100% 마진율이어야 함', () => {
      const result = calculateMarginRate(100, 50);
      expect(result).toBe(100);
    });

    it('소수점 둘째 자리까지 반올림해야 함', () => {
      const result = calculateMarginRate(44.43, 33.33);
      expect(result).toBe(33.3); // (44.43 / 33.33 - 1) × 100 = 33.3033 → 반올림 33.3
    });
  });

  describe('에러 케이스', () => {
    it('아마존 가격이 0 이하면 에러를 발생시켜야 함', () => {
      expect(() => calculateMarginRate(100, 0)).toThrow(
        '아마존 가격은 0보다 커야 합니다.'
      );
    });

    it('판매가가 아마존 가격보다 작거나 같으면 에러를 발생시켜야 함', () => {
      expect(() => calculateMarginRate(50, 100)).toThrow(
        '판매가는 아마존 가격보다 커야 합니다.'
      );
    });
  });
});
