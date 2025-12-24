-- ============================================================================
-- V1 마이그레이션 수정: 기존 트리거 제거 후 재생성
-- ============================================================================

-- 기존 트리거 제거 (이미 존재하는 경우)
DROP TRIGGER IF EXISTS update_products_v1_updated_at ON products_v1;

-- 트리거 다시 생성
CREATE TRIGGER update_products_v1_updated_at
  BEFORE UPDATE ON products_v1
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- V1 마이그레이션 완료 확인
DO $$
DECLARE
  v1_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v1_count FROM products_v1;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'V1 마이그레이션 확인';
  RAISE NOTICE 'products_v1: % 개', v1_count;
  RAISE NOTICE '========================================';
END $$;

