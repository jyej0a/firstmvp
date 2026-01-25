/**
 * @file lib/pricing/calculator.ts
 * @description 상품 가격 자동 계산 로직
 *
 * 이 파일은 US 타입과 CN 타입의 판매가를 자동으로 계산하는 로직을 제공합니다.
 *
 * 주요 기능:
 * 1. US 타입 판매가 계산 (아마존 가격 기반)
 * 2. CN 타입 판매가 계산 (타오바오 원가 기반, v1.1)
 * 3. 가격 데이터 유효성 검증
 *
 * @see {@link /docs/PRD.md} - 가격 계산 공식 명세
 * @see {@link /docs/TODO.md#2.14} - 구현 계획
 */

import type { SourcingType } from "@/types";

/**
 * 가격 계산 입력 데이터 인터페이스
 */
export interface PriceCalculationInput {
  /** 소싱 타입 (US 또는 CN) */
  sourcingType: SourcingType;

  /** 아마존 판매 가격 (US 타입 전용) */
  amazonPrice?: number;

  /** 타오바오 원가 (CN 타입 전용) */
  costPrice?: number;

  /** 배송비 (US/CN 타입 공통) */
  shippingCost?: number;

  /** 추가 비용/관세 (US/CN 타입 공통) */
  extraCost?: number;

  /** 희망 마진율 (0-100 사이, 기본값: 40%) */
  marginRate: number;
}

/**
 * 가격 계산 결과 인터페이스
 */
export interface PriceCalculationResult {
  /** 최종 판매 가격 */
  sellingPrice: number;

  /** 계산에 사용된 마진율 */
  marginRate: number;

  /** 계산 성공 여부 */
  success: boolean;

  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 가격 데이터 유효성 검증
 *
 * @param input - 가격 계산 입력 데이터
 * @returns 검증 결과 { valid: boolean, error?: string }
 */
export function validatePriceData(
  input: PriceCalculationInput
): { valid: boolean; error?: string } {
  // 1. 마진율 검증 (0-100%)
  if (input.marginRate < 0 || input.marginRate > 100) {
    return {
      valid: false,
      error: "마진율은 0%에서 100% 사이여야 합니다.",
    };
  }

  // 2. US 타입 검증
  if (input.sourcingType === "US") {
    if (!input.amazonPrice || input.amazonPrice <= 0) {
      return {
        valid: false,
        error: "아마존 가격은 0보다 커야 합니다.",
      };
    }

    // 배송비와 추가 비용은 선택사항이지만, 있다면 0 이상이어야 함
    if (input.shippingCost !== undefined && input.shippingCost < 0) {
      return {
        valid: false,
        error: "배송비는 0 이상이어야 합니다.",
      };
    }

    if (input.extraCost !== undefined && input.extraCost < 0) {
      return {
        valid: false,
        error: "추가 비용은 0 이상이어야 합니다.",
      };
    }
  }

  // 3. CN 타입 검증 (v1.1)
  if (input.sourcingType === "CN") {
    if (!input.costPrice || input.costPrice <= 0) {
      return {
        valid: false,
        error: "원가는 0보다 커야 합니다.",
      };
    }

    // 배송비와 추가 비용은 선택사항이지만, 있다면 0 이상이어야 함
    if (input.shippingCost !== undefined && input.shippingCost < 0) {
      return {
        valid: false,
        error: "배송비는 0 이상이어야 합니다.",
      };
    }

    if (input.extraCost !== undefined && input.extraCost < 0) {
      return {
        valid: false,
        error: "추가 비용은 0 이상이어야 합니다.",
      };
    }
  }

  return { valid: true };
}

/**
 * US 타입 판매가 계산 (v1.2 - 배송비 및 추가 비용 반영)
 *
 * 공식: (amazonPrice + shippingCost + extraCost) / (1 - marginRate / 100)
 *
 * @param amazonPrice - 아마존 판매 가격
 * @param shippingCost - 배송비 (기본값: 0)
 * @param extraCost - 추가 비용/관세 (기본값: 0)
 * @param marginRate - 희망 마진율 (0-100)
 * @returns 최종 판매 가격
 *
 * @example
 * const sellingPrice = calculateSellingPriceUS(29.99, 2.0, 1.0, 40);
 * // sellingPrice = 54.98
 */
export function calculateSellingPriceUS(
  amazonPrice: number,
  marginRate: number,
  shippingCost: number = 0,
  extraCost: number = 0
): number {
  // 입력값 검증
  const validation = validatePriceData({
    sourcingType: "US",
    amazonPrice,
    shippingCost,
    extraCost,
    marginRate,
  });

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 마진율이 100%이면 나누기 0 오류 발생 방지
  if (marginRate >= 100) {
    throw new Error("마진율은 100% 미만이어야 합니다.");
  }

  // 공식: (amazonPrice + shippingCost + extraCost) / (1 - marginRate / 100)
  const totalCost = amazonPrice + shippingCost + extraCost;
  const sellingPrice = totalCost / (1 - marginRate / 100);

  // 소수점 둘째 자리까지 반올림
  return Math.round(sellingPrice * 100) / 100;
}

/**
 * CN 타입 판매가 계산 (v1.1)
 *
 * 공식: (costPrice + shippingCost + extraCost) / (1 - marginRate / 100)
 *
 * @param costPrice - 타오바오 원가
 * @param shippingCost - 배송비 (기본값: 0)
 * @param extraCost - 추가 비용/관세 (기본값: 0)
 * @param marginRate - 희망 마진율 (0-100)
 * @returns 최종 판매 가격
 *
 * @example
 * const sellingPrice = calculateSellingPriceCN(3.0, 2.0, 1.0, 40);
 * // sellingPrice = 10.00
 */
export function calculateSellingPriceCN(
  costPrice: number,
  shippingCost: number = 0,
  extraCost: number = 0,
  marginRate: number
): number {
  // 입력값 검증
  const validation = validatePriceData({
    sourcingType: "CN",
    costPrice,
    shippingCost,
    extraCost,
    marginRate,
  });

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 마진율이 100%이면 나누기 0 오류 발생 방지
  if (marginRate >= 100) {
    throw new Error("마진율은 100% 미만이어야 합니다.");
  }

  // 공식: (costPrice + shippingCost + extraCost) / (1 - marginRate / 100)
  const totalCost = costPrice + shippingCost + extraCost;
  const sellingPrice = totalCost / (1 - marginRate / 100);

  // 소수점 둘째 자리까지 반올림
  return Math.round(sellingPrice * 100) / 100;
}

/**
 * 자동 가격 계산 (소싱 타입에 따라 자동 선택)
 *
 * @param input - 가격 계산 입력 데이터
 * @returns 가격 계산 결과
 *
 * @example
 * // US 타입
 * const result = calculatePrice({
 *   sourcingType: 'US',
 *   amazonPrice: 29.99,
 *   marginRate: 40
 * });
 *
 * // CN 타입
 * const result = calculatePrice({
 *   sourcingType: 'CN',
 *   costPrice: 3.0,
 *   shippingCost: 2.0,
 *   extraCost: 1.0,
 *   marginRate: 40
 * });
 */
export function calculatePrice(
  input: PriceCalculationInput
): PriceCalculationResult {
  try {
    // 유효성 검증
    const validation = validatePriceData(input);
    if (!validation.valid) {
      return {
        sellingPrice: 0,
        marginRate: input.marginRate,
        success: false,
        error: validation.error,
      };
    }

    // 소싱 타입에 따라 계산
    let sellingPrice: number;

    if (input.sourcingType === "US") {
      if (!input.amazonPrice) {
        throw new Error("아마존 가격이 필요합니다.");
      }
      sellingPrice = calculateSellingPriceUS(
        input.amazonPrice,
        input.marginRate,
        input.shippingCost || 0,
        input.extraCost || 0
      );
    } else {
      // CN 타입
      if (!input.costPrice) {
        throw new Error("원가가 필요합니다.");
      }
      sellingPrice = calculateSellingPriceCN(
        input.costPrice,
        input.shippingCost || 0,
        input.extraCost || 0,
        input.marginRate
      );
    }

    return {
      sellingPrice,
      marginRate: input.marginRate,
      success: true,
    };
  } catch (error) {
    return {
      sellingPrice: 0,
      marginRate: input.marginRate,
      success: false,
      error: error instanceof Error ? error.message : "가격 계산 실패",
    };
  }
}

/**
 * 마진율 역계산 (판매가와 아마존 가격으로부터 마진율 계산)
 *
 * @param sellingPrice - 최종 판매 가격
 * @param amazonPrice - 아마존 판매 가격
 * @returns 마진율 (0-100)
 *
 * @example
 * const marginRate = calculateMarginRate(41.99, 29.99);
 * // marginRate = 40.01 (약 40%)
 */
export function calculateMarginRate(
  sellingPrice: number,
  amazonPrice: number
): number {
  if (amazonPrice <= 0) {
    throw new Error("아마존 가격은 0보다 커야 합니다.");
  }

  if (sellingPrice <= amazonPrice) {
    throw new Error("판매가는 아마존 가격보다 커야 합니다.");
  }

  // 역계산: marginRate = ((sellingPrice / amazonPrice) - 1) × 100
  const marginRate = ((sellingPrice / amazonPrice) - 1) * 100;

  // 소수점 둘째 자리까지 반올림
  return Math.round(marginRate * 100) / 100;
}
