-- ============================================================================
-- Migration: Create banned_keywords table
-- Description: IP/브랜드명 필터링을 위한 금지어 목록 테이블
-- Created: 2024-12-04
-- ============================================================================

-- Banned Keywords 테이블 생성
CREATE TABLE IF NOT EXISTS banned_keywords (
  -- 기본 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 금지어 키워드
  keyword TEXT NOT NULL UNIQUE,  -- 중복 방지
  
  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 제약 조건
  CONSTRAINT non_empty_keyword CHECK (LENGTH(TRIM(keyword)) > 0)
);

-- 인덱스 생성 (검색 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_banned_keywords_keyword ON banned_keywords(LOWER(keyword));

-- 테이블 설명 (주석)
COMMENT ON TABLE banned_keywords IS 'IP/브랜드명 필터링을 위한 금지어 목록';
COMMENT ON COLUMN banned_keywords.keyword IS '금지어 (대소문자 구분 없이 필터링됨)';

-- ============================================================================
-- 초기 금지어 데이터 INSERT
-- PRD 명세에 따른 주요 브랜드명 및 IP 포함
-- ============================================================================

INSERT INTO banned_keywords (keyword) VALUES
  -- 스포츠 브랜드
  ('Nike'),
  ('Adidas'),
  ('Puma'),
  ('Reebok'),
  ('Under Armour'),
  
  -- 테크 브랜드
  ('Apple'),
  ('Samsung'),
  ('Sony'),
  ('Microsoft'),
  ('Google'),
  
  -- 패션/명품 브랜드
  ('Gucci'),
  ('Louis Vuitton'),
  ('Chanel'),
  ('Prada'),
  ('Rolex')
ON CONFLICT (keyword) DO NOTHING;  -- 이미 존재하면 무시

-- 금지어 개수 확인 (로그용)
DO $$
DECLARE
  keyword_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO keyword_count FROM banned_keywords;
  RAISE NOTICE '금지어 테이블에 % 개의 키워드가 저장되었습니다.', keyword_count;
END $$;

