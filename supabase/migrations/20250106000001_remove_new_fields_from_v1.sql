-- ============================================================================
-- Migration: Remove new scraping fields from products_v1
-- Description: v1에서 새로 추가된 스크래핑 필드 제거 (v2에만 유지)
-- Created: 2025-01-06
-- 
-- 목적:
-- - v1은 기본 필드만 유지 (category, review_count, rating, brand, weight 제거)
-- - v2는 모든 새 필드 유지
-- ============================================================================

-- ============================================================================
-- 1단계: products_v1에서 새 필드 제거
-- ============================================================================

-- 인덱스 먼저 제거
DROP INDEX IF EXISTS idx_products_v1_category;
DROP INDEX IF EXISTS idx_products_v1_rating;
DROP INDEX IF EXISTS idx_products_v1_brand;

-- 컬럼 제거
ALTER TABLE products_v1 DROP COLUMN IF EXISTS category;
ALTER TABLE products_v1 DROP COLUMN IF EXISTS review_count;
ALTER TABLE products_v1 DROP COLUMN IF EXISTS rating;
ALTER TABLE products_v1 DROP COLUMN IF EXISTS brand;
ALTER TABLE products_v1 DROP COLUMN IF EXISTS weight;

-- 테이블 설명 업데이트
COMMENT ON TABLE products_v1 IS 'V1 시스템의 상품 데이터 (히스토리 보존용, 기본 필드만 포함)';

-- ============================================================================
-- 2단계: 확인
-- ============================================================================

DO $$
DECLARE
  v1_columns TEXT[];
  v2_columns TEXT[];
BEGIN
  -- v1 컬럼 목록 확인
  SELECT array_agg(column_name ORDER BY ordinal_position) INTO v1_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products_v1';
  
  -- v2 컬럼 목록 확인
  SELECT array_agg(column_name ORDER BY ordinal_position) INTO v2_columns
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'products_v2';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'V1/V2 스키마 분리 완료!';
  RAISE NOTICE 'products_v1 컬럼 수: %', array_length(v1_columns, 1);
  RAISE NOTICE 'products_v2 컬럼 수: %', array_length(v2_columns, 1);
  RAISE NOTICE '========================================';
END $$;

