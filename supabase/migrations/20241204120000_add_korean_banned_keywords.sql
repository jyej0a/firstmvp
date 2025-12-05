-- ============================================================================
-- Migration: Add Korean brand names to banned_keywords
-- Description: 한글 브랜드명 금지어 추가 (한국어로 된 상품 제목 필터링용)
-- Created: 2024-12-04
-- ============================================================================

-- 한글 브랜드명 금지어 추가
INSERT INTO banned_keywords (keyword) VALUES
  -- 스포츠 브랜드 (한글)
  ('나이키'),
  ('아디다스'),
  ('퓨마'),
  ('리복'),
  ('언더아머'),
  ('언더 아머'),
  
  -- 테크 브랜드 (한글)
  ('애플'),
  ('삼성'),
  ('소니'),
  ('마이크로소프트'),
  ('구글'),
  
  -- 패션/명품 브랜드 (한글)
  ('구찌'),
  ('루이비통'),
  ('루이 비통'),
  ('샤넬'),
  ('프라다'),
  ('롤렉스')
ON CONFLICT (keyword) DO NOTHING;

-- Nike 주요 제품 라인명 추가 (영어로 된 제품명 필터링용)
INSERT INTO banned_keywords (keyword) VALUES
  ('Air Jordan'),
  ('Air Max'),
  ('Air Force'),
  ('Dunk'),
  ('Cortez'),
  ('Blazer'),
  ('Huarache'),
  ('Presto'),
  ('Mercurial'),
  ('Tiempo')
ON CONFLICT (keyword) DO NOTHING;

-- Adidas 주요 제품 라인명 추가
INSERT INTO banned_keywords (keyword) VALUES
  ('Yeezy'),
  ('Ultraboost'),
  ('Stan Smith'),
  ('Superstar'),
  ('NMD'),
  ('Gazelle')
ON CONFLICT (keyword) DO NOTHING;

-- 기타 주요 브랜드 제품 라인
INSERT INTO banned_keywords (keyword) VALUES
  -- Under Armour
  ('Charged'),
  ('HOVR'),
  
  -- Apple 제품
  ('iPhone'),
  ('iPad'),
  ('MacBook'),
  ('AirPods'),
  ('Apple Watch'),
  
  -- Samsung 제품
  ('Galaxy'),
  ('갤럭시')
ON CONFLICT (keyword) DO NOTHING;

-- 금지어 개수 확인
DO $$
DECLARE
  keyword_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO keyword_count FROM banned_keywords;
  RAISE NOTICE '금지어 테이블에 총 % 개의 키워드가 저장되었습니다. (영어 + 한글)', keyword_count;
END $$;

