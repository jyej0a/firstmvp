-- ============================================================================
-- Migration: Separate V1 and V2 Products Tables
-- Description: V1과 V2의 데이터 관리를 이원화하기 위한 마이그레이션
-- Created: 2025-12-23
-- 
-- 목적:
-- - V1: 히스토리 자료로 보존 (더 이상 사용하지 않음)
-- - V2: 새로운 시스템으로 운영
-- ============================================================================

-- ============================================================================
-- 1단계: products_v1 테이블 생성 (기존 products와 동일한 구조)
-- ============================================================================

CREATE TABLE IF NOT EXISTS products_v1 (
  -- 기본 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 사용자 정보
  user_id TEXT NOT NULL,  -- Clerk User ID
  
  -- 아마존 상품 정보
  asin TEXT NOT NULL,  -- Amazon Standard Identification Number (고유값)
  source_url TEXT NOT NULL,  -- 아마존 상품 URL
  title TEXT NOT NULL,  -- 상품명
  description TEXT,  -- 상품 설명 (nullable)
  
  -- 이미지 및 옵션
  images TEXT[] NOT NULL DEFAULT '{}',  -- 이미지 URL 배열
  variants JSONB,  -- 상품 옵션 (색상, 크기 등)
  
  -- 소싱 정보
  sourcing_type TEXT NOT NULL DEFAULT 'US',  -- US 또는 CN
  
  -- 가격 정보 (US 타입용)
  amazon_price DECIMAL(10, 2) NOT NULL,  -- 아마존 판매 가격
  
  -- 가격 정보 (CN 타입용)
  cost_price DECIMAL(10, 2),  -- 타오바오 원가 (CN 타입 전용)
  shipping_cost DECIMAL(10, 2),  -- 배송비 (CN 타입 전용)
  extra_cost DECIMAL(10, 2),  -- 추가 비용/관세 (CN 타입 전용)
  
  -- 마진 및 최종 가격
  margin_rate DECIMAL(5, 2) NOT NULL DEFAULT 40.00,  -- 마진율 (기본 40%)
  selling_price DECIMAL(10, 2) NOT NULL,  -- 최종 판매 가격
  
  -- 상태 관리
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, uploaded, error
  error_message TEXT,  -- 에러 발생 시 메시지
  
  -- 추가 필드 (나중에 추가된 컬럼들)
  category TEXT NOT NULL DEFAULT 'General',
  review_count INTEGER,
  rating DECIMAL(3, 2),
  brand TEXT,
  weight DECIMAL(10, 3),
  
  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 제약 조건
  CONSTRAINT unique_asin_v1 UNIQUE(asin),
  CONSTRAINT valid_sourcing_type_v1 CHECK (sourcing_type IN ('US', 'CN')),
  CONSTRAINT valid_status_v1 CHECK (status IN ('draft', 'uploaded', 'error')),
  CONSTRAINT positive_amazon_price_v1 CHECK (amazon_price > 0),
  CONSTRAINT positive_selling_price_v1 CHECK (selling_price > 0),
  CONSTRAINT valid_margin_rate_v1 CHECK (margin_rate >= 0 AND margin_rate <= 100),
  CONSTRAINT valid_rating_v1 CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  CONSTRAINT positive_weight_v1 CHECK (weight IS NULL OR weight >= 0)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_products_v1_user_id ON products_v1(user_id);
CREATE INDEX IF NOT EXISTS idx_products_v1_asin ON products_v1(asin);
CREATE INDEX IF NOT EXISTS idx_products_v1_status ON products_v1(status);
CREATE INDEX IF NOT EXISTS idx_products_v1_created_at ON products_v1(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_v1_category ON products_v1(category);
CREATE INDEX IF NOT EXISTS idx_products_v1_rating ON products_v1(rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_products_v1_brand ON products_v1(brand);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_products_v1_updated_at
  BEFORE UPDATE ON products_v1
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 테이블 설명
COMMENT ON TABLE products_v1 IS 'V1 시스템의 상품 데이터 (히스토리 보존용, 더 이상 사용하지 않음)';
COMMENT ON COLUMN products_v1.asin IS '아마존 고유 상품 식별자 (Amazon Standard Identification Number)';
COMMENT ON COLUMN products_v1.sourcing_type IS '소싱 타입: US (아마존 가격 기반) 또는 CN (타오바오 원가 기반)';
COMMENT ON COLUMN products_v1.margin_rate IS '희망 마진율 (0-100 사이의 퍼센트 값)';
COMMENT ON COLUMN products_v1.status IS '상품 상태: draft (수집 완료), uploaded (Shopify 등록 완료), error (등록 실패)';

-- ============================================================================
-- 2단계: products_v2 테이블 생성 (V2 시스템용, 구조는 동일)
-- ============================================================================

CREATE TABLE IF NOT EXISTS products_v2 (
  -- 기본 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 사용자 정보
  user_id TEXT NOT NULL,  -- Clerk User ID
  
  -- 아마존 상품 정보
  asin TEXT NOT NULL,  -- Amazon Standard Identification Number (고유값)
  source_url TEXT NOT NULL,  -- 아마존 상품 URL
  title TEXT NOT NULL,  -- 상품명
  description TEXT,  -- 상품 설명 (nullable)
  
  -- 이미지 및 옵션
  images TEXT[] NOT NULL DEFAULT '{}',  -- 이미지 URL 배열
  variants JSONB,  -- 상품 옵션 (색상, 크기 등)
  
  -- 소싱 정보
  sourcing_type TEXT NOT NULL DEFAULT 'US',  -- US 또는 CN
  
  -- 가격 정보 (US 타입용)
  amazon_price DECIMAL(10, 2) NOT NULL,  -- 아마존 판매 가격
  
  -- 가격 정보 (CN 타입용)
  cost_price DECIMAL(10, 2),  -- 타오바오 원가 (CN 타입 전용)
  shipping_cost DECIMAL(10, 2),  -- 배송비 (CN 타입 전용)
  extra_cost DECIMAL(10, 2),  -- 추가 비용/관세 (CN 타입 전용)
  
  -- 마진 및 최종 가격
  margin_rate DECIMAL(5, 2) NOT NULL DEFAULT 40.00,  -- 마진율 (기본 40%)
  selling_price DECIMAL(10, 2) NOT NULL,  -- 최종 판매 가격
  
  -- 상태 관리
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, uploaded, error
  error_message TEXT,  -- 에러 발생 시 메시지
  
  -- 추가 필드
  category TEXT NOT NULL DEFAULT 'General',
  review_count INTEGER,
  rating DECIMAL(3, 2),
  brand TEXT,
  weight DECIMAL(10, 3),
  
  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 제약 조건
  CONSTRAINT unique_asin_v2 UNIQUE(asin),
  CONSTRAINT valid_sourcing_type_v2 CHECK (sourcing_type IN ('US', 'CN')),
  CONSTRAINT valid_status_v2 CHECK (status IN ('draft', 'uploaded', 'error')),
  CONSTRAINT positive_amazon_price_v2 CHECK (amazon_price > 0),
  CONSTRAINT positive_selling_price_v2 CHECK (selling_price > 0),
  CONSTRAINT valid_margin_rate_v2 CHECK (margin_rate >= 0 AND margin_rate <= 100),
  CONSTRAINT valid_rating_v2 CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  CONSTRAINT positive_weight_v2 CHECK (weight IS NULL OR weight >= 0)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_products_v2_user_id ON products_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_products_v2_asin ON products_v2(asin);
CREATE INDEX IF NOT EXISTS idx_products_v2_status ON products_v2(status);
CREATE INDEX IF NOT EXISTS idx_products_v2_created_at ON products_v2(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_v2_category ON products_v2(category);
CREATE INDEX IF NOT EXISTS idx_products_v2_rating ON products_v2(rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_products_v2_brand ON products_v2(brand);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_products_v2_updated_at
  BEFORE UPDATE ON products_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 테이블 설명
COMMENT ON TABLE products_v2 IS 'V2 시스템의 상품 데이터 (새로운 시스템, 순차 처리 스크래핑)';
COMMENT ON COLUMN products_v2.asin IS '아마존 고유 상품 식별자 (Amazon Standard Identification Number)';
COMMENT ON COLUMN products_v2.sourcing_type IS '소싱 타입: US (아마존 가격 기반) 또는 CN (타오바오 원가 기반)';
COMMENT ON COLUMN products_v2.margin_rate IS '희망 마진율 (0-100 사이의 퍼센트 값)';
COMMENT ON COLUMN products_v2.status IS '상품 상태: draft (수집 완료), uploaded (Shopify 등록 완료), error (등록 실패)';

-- ============================================================================
-- 3단계: 기존 products 데이터를 products_v1으로 마이그레이션
-- ============================================================================

-- 기존 products 테이블이 존재하고 데이터가 있다면 products_v1으로 복사
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  -- products 테이블 존재 여부 확인
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'products'
  ) THEN
    -- 데이터 복사
    INSERT INTO products_v1 (
      id, user_id, asin, source_url, title, description,
      images, variants, sourcing_type,
      amazon_price, cost_price, shipping_cost, extra_cost,
      margin_rate, selling_price,
      status, error_message,
      category, review_count, rating, brand, weight,
      created_at, updated_at
    )
    SELECT 
      id, user_id, asin, source_url, title, description,
      images, variants, sourcing_type,
      amazon_price, cost_price, shipping_cost, extra_cost,
      margin_rate, selling_price,
      status, error_message,
      COALESCE(category, 'General'), review_count, rating, brand, weight,
      created_at, updated_at
    FROM products
    ON CONFLICT (asin) DO NOTHING;  -- 중복 방지
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'products_v1으로 % 개의 데이터가 마이그레이션되었습니다.', row_count;
  ELSE
    RAISE NOTICE 'products 테이블이 존재하지 않습니다. 마이그레이션을 건너뜁니다.';
  END IF;
END $$;

-- ============================================================================
-- 4단계: 기존 products 데이터를 products_v2에도 복사 (V2도 기존 데이터 필요)
-- ============================================================================

-- 기존 products 테이블이 존재하고 데이터가 있다면 products_v2에도 복사
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  -- products 테이블 존재 여부 확인
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'products'
  ) THEN
    -- 데이터 복사 (V2도 기존 데이터를 가져야 scraping_job_items 외래키가 유효함)
    INSERT INTO products_v2 (
      id, user_id, asin, source_url, title, description,
      images, variants, sourcing_type,
      amazon_price, cost_price, shipping_cost, extra_cost,
      margin_rate, selling_price,
      status, error_message,
      category, review_count, rating, brand, weight,
      created_at, updated_at
    )
    SELECT 
      id, user_id, asin, source_url, title, description,
      images, variants, sourcing_type,
      amazon_price, cost_price, shipping_cost, extra_cost,
      margin_rate, selling_price,
      status, error_message,
      COALESCE(category, 'General'), review_count, rating, brand, weight,
      created_at, updated_at
    FROM products
    ON CONFLICT (asin) DO NOTHING;  -- 중복 방지
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'products_v2로 % 개의 데이터가 마이그레이션되었습니다.', row_count;
  ELSE
    RAISE NOTICE 'products 테이블이 존재하지 않습니다. 마이그레이션을 건너뜁니다.';
  END IF;
END $$;

-- ============================================================================
-- 5단계: scraping_job_items의 외래키를 products_v2로 변경
-- ============================================================================

-- 기존 외래키 제약 조건 삭제 (products 참조)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'scraping_job_items'
    AND constraint_name LIKE '%product%'
  ) THEN
    -- 외래키 제약 조건 이름 찾기
    DECLARE
      fk_name TEXT;
    BEGIN
      SELECT constraint_name INTO fk_name
      FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
      AND table_name = 'scraping_job_items'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%product%'
      LIMIT 1;
      
      IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE scraping_job_items DROP CONSTRAINT IF EXISTS %I', fk_name);
        RAISE NOTICE '기존 외래키 제약 조건 % 제거됨', fk_name;
      END IF;
    END;
  END IF;
END $$;

-- 새로운 외래키 제약 조건 추가 (products_v2 참조)
ALTER TABLE scraping_job_items
DROP CONSTRAINT IF EXISTS scraping_job_items_product_id_fkey;

ALTER TABLE scraping_job_items
ADD CONSTRAINT scraping_job_items_product_id_fkey
FOREIGN KEY (product_id) 
REFERENCES products_v2(id) 
ON DELETE SET NULL;

COMMENT ON COLUMN scraping_job_items.product_id IS 'V2 시스템의 products_v2 테이블과 연결 (nullable)';

-- ============================================================================
-- 6단계: 마이그레이션 완료 확인
-- ============================================================================

DO $$
DECLARE
  v1_count INTEGER;
  v2_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v1_count FROM products_v1;
  SELECT COUNT(*) INTO v2_count FROM products_v2;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '마이그레이션 완료!';
  RAISE NOTICE 'products_v1: % 개', v1_count;
  RAISE NOTICE 'products_v2: % 개', v2_count;
  RAISE NOTICE '========================================';
END $$;

