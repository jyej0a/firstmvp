-- ============================================================================
-- Migration: Create products table
-- Description: 아마존에서 수집한 상품 정보를 저장하는 테이블
-- Created: 2024-12-04
-- ============================================================================

-- Products 테이블 생성
CREATE TABLE IF NOT EXISTS products (
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
  
  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 제약 조건
  CONSTRAINT unique_asin UNIQUE(asin),
  CONSTRAINT valid_sourcing_type CHECK (sourcing_type IN ('US', 'CN')),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'uploaded', 'error')),
  CONSTRAINT positive_amazon_price CHECK (amazon_price > 0),
  CONSTRAINT positive_selling_price CHECK (selling_price > 0),
  CONSTRAINT valid_margin_rate CHECK (margin_rate >= 0 AND margin_rate <= 100)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_asin ON products(asin);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 테이블 설명 (주석)
COMMENT ON TABLE products IS '아마존에서 수집한 상품 정보를 저장하는 테이블';
COMMENT ON COLUMN products.asin IS '아마존 고유 상품 식별자 (Amazon Standard Identification Number)';
COMMENT ON COLUMN products.sourcing_type IS '소싱 타입: US (아마존 가격 기반) 또는 CN (타오바오 원가 기반)';
COMMENT ON COLUMN products.margin_rate IS '희망 마진율 (0-100 사이의 퍼센트 값)';
COMMENT ON COLUMN products.status IS '상품 상태: draft (수집 완료), uploaded (Shopify 등록 완료), error (등록 실패)';

