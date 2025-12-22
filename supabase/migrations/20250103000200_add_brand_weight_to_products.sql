-- ============================================================================
-- Migration: Add brand and weight columns to products table
-- Description: 브랜드명 및 무게 컬럼 추가 (Shopify 등록 시 vendor 및 variants[].weight로 사용)
-- Created: 2025-01-03
-- ============================================================================

-- 브랜드명 컬럼 추가 (nullable)
ALTER TABLE products
ADD COLUMN brand TEXT;

-- 무게 컬럼 추가 (nullable, 킬로그램 단위, 소수점 3자리)
ALTER TABLE products
ADD COLUMN weight DECIMAL(10, 3);

-- 무게 양수 제약 조건 추가
ALTER TABLE products
ADD CONSTRAINT positive_weight CHECK (weight IS NULL OR weight >= 0);

-- 컬럼 설명 추가
COMMENT ON COLUMN products.brand IS '브랜드명 (Shopify 등록 시 vendor 필드로 사용, 기존 "Trend-Hybrid" 고정값 대체)';
COMMENT ON COLUMN products.weight IS '상품 무게 (킬로그램 단위, 소수점 3자리, Shopify 등록 시 variants[].weight 및 variants[].weight_unit로 사용)';

-- 인덱스 생성 (브랜드 검색 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

-- 기존 데이터 확인 (모두 NULL로 유지됨)
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM products WHERE brand IS NULL AND weight IS NULL;
  RAISE NOTICE '브랜드명/무게 컬럼 추가 완료. 기존 데이터 % 개가 NULL로 유지되었습니다.', null_count;
END $$;

