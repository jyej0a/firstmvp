-- ============================================================================
-- Migration: Add category column to products table
-- Description: 상품 카테고리 컬럼 추가 (Shopify 등록 시 product_type으로 사용)
-- Created: 2025-01-03
-- ============================================================================

-- 카테고리 컬럼 추가 (NOT NULL, 기본값 'General')
ALTER TABLE products
ADD COLUMN category TEXT NOT NULL DEFAULT 'General';

-- 컬럼 설명 추가
COMMENT ON COLUMN products.category IS '상품 카테고리 (Shopify 등록 시 product_type으로 사용, 스크래핑 시 필수 수집)';

-- 인덱스 생성 (카테고리 검색 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 기존 데이터 확인 (모두 'General'로 설정됨)
DO $$
DECLARE
  category_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO category_count FROM products WHERE category = 'General';
  RAISE NOTICE '카테고리 컬럼 추가 완료. 기존 데이터 % 개가 "General"로 설정되었습니다.', category_count;
END $$;

