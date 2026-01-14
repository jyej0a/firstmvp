-- ============================================================================
-- Migration: Create category_mapping table
-- Description: 아마존 카테고리와 쇼피파이 카테고리 매핑 테이블
-- Created: 2025-01-06
-- ============================================================================

-- 카테고리 매핑 테이블 생성
CREATE TABLE IF NOT EXISTS category_mapping (
  -- 기본 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 아마존 카테고리 정보
  amazon_category_name TEXT NOT NULL,  -- 아마존 카테고리 이름 (예: "Electronics > Computers > Laptops")
  amazon_browse_node_id TEXT,  -- 아마존 Browse Node ID (선택값, 변경될 수 있음)
  
  -- 쇼피파이 카테고리 정보
  shopify_category_id TEXT,  -- 쇼피파이 TaxonomyCategory ID (예: "gid://shopify/TaxonomyCategory/aa-8")
  shopify_category_name TEXT,  -- 쇼피파이 카테고리 이름 (예: "Electronics > Computers > Laptops")
  
  -- 매칭 정보
  match_confidence DECIMAL(3, 2) DEFAULT 0.0,  -- 매칭 신뢰도 (0.0-1.0)
  match_method TEXT DEFAULT 'auto',  -- 매칭 방법: 'auto', 'manual', 'api'
  
  -- 상태 관리
  is_active BOOLEAN DEFAULT true,  -- 활성화 여부
  last_verified_at TIMESTAMPTZ,  -- 마지막 검증 일시
  
  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 제약 조건
  CONSTRAINT valid_match_confidence CHECK (match_confidence >= 0.0 AND match_confidence <= 1.0),
  CONSTRAINT valid_match_method CHECK (match_method IN ('auto', 'manual', 'api'))
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_category_mapping_amazon_name ON category_mapping(amazon_category_name);
CREATE INDEX IF NOT EXISTS idx_category_mapping_shopify_id ON category_mapping(shopify_category_id);
CREATE INDEX IF NOT EXISTS idx_category_mapping_active ON category_mapping(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_category_mapping_confidence ON category_mapping(match_confidence DESC);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_category_mapping_updated_at
  BEFORE UPDATE ON category_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 테이블 설명
COMMENT ON TABLE category_mapping IS '아마존 카테고리와 쇼피파이 카테고리 매핑 테이블';
COMMENT ON COLUMN category_mapping.amazon_category_name IS '아마존 카테고리 이름 (전체 경로, 예: "Electronics > Computers > Laptops")';
COMMENT ON COLUMN category_mapping.amazon_browse_node_id IS '아마존 Browse Node ID (선택값, 자주 변경됨)';
COMMENT ON COLUMN category_mapping.shopify_category_id IS '쇼피파이 TaxonomyCategory ID (예: "gid://shopify/TaxonomyCategory/aa-8")';
COMMENT ON COLUMN category_mapping.shopify_category_name IS '쇼피파이 카테고리 이름 (전체 경로)';
COMMENT ON COLUMN category_mapping.match_confidence IS '매칭 신뢰도 (0.0-1.0, 1.0이 완벽한 매칭)';
COMMENT ON COLUMN category_mapping.match_method IS '매칭 방법: auto(자동), manual(수동), api(API 기반)';
COMMENT ON COLUMN category_mapping.is_active IS '활성화 여부 (false면 사용 안 함)';
COMMENT ON COLUMN category_mapping.last_verified_at IS '마지막 검증 일시 (카테고리 유효성 확인)';

