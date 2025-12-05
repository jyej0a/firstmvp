-- ============================================================================
-- Migration: 금지어 목록에 한글 브랜드명 및 주요 제품 라인 추가
-- Created: 2024-12-04
-- Description: 
--   - 영어 브랜드명의 한글 표기 추가 (나이키, 아디다스 등)
--   - 주요 브랜드의 대표 제품 라인명 추가 (Air Jordan, Dunk 등)
--   - 다양한 표기 방식 고려 (띄어쓰기, 하이픈 등)
-- ============================================================================

-- 한글 브랜드명 추가
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

-- Nike 주요 제품 라인명 추가
INSERT INTO banned_keywords (keyword) VALUES
  -- Nike 주요 라인
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
  -- Adidas 주요 라인
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

-- 금지어 개수 확인 (로그용)
DO $$
DECLARE
  keyword_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO keyword_count FROM banned_keywords;
  RAISE NOTICE '금지어 테이블에 총 % 개의 키워드가 저장되었습니다.', keyword_count;
END $$;


