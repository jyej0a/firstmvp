-- ============================================================================
-- Migration: Add review_count and rating columns to products table
-- Description: 리뷰수 및 평점 컬럼 추가 (DB/UI 표시용, Shopify 등록 시 불필요)
-- Created: 2025-01-03
-- ============================================================================

-- 리뷰수 컬럼 추가 (nullable)
ALTER TABLE products
ADD COLUMN review_count INTEGER;

-- 평점 컬럼 추가 (nullable, 0-5 범위)
ALTER TABLE products
ADD COLUMN rating DECIMAL(3, 2);

-- 평점 범위 제약 조건 추가
ALTER TABLE products
ADD CONSTRAINT valid_rating CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));

-- 컬럼 설명 추가
COMMENT ON COLUMN products.review_count IS '리뷰 개수 (DB/UI 표시용, Shopify 등록 시 불필요)';
COMMENT ON COLUMN products.rating IS '평점 (0-5 범위, DB/UI 표시용, Shopify 등록 시 불필요)';

-- 인덱스 생성 (평점 기반 정렬 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating DESC NULLS LAST);

-- 기존 데이터 확인 (모두 NULL로 유지됨)
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM products WHERE review_count IS NULL AND rating IS NULL;
  RAISE NOTICE '리뷰수/평점 컬럼 추가 완료. 기존 데이터 % 개가 NULL로 유지되었습니다.', null_count;
END $$;

