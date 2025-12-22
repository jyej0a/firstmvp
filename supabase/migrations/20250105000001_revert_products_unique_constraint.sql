-- ============================================================================
-- Migration: Revert products unique constraint to ASIN only
-- Description: user_id + asin 복합 unique 제약을 제거하고 asin만 unique로 복원
-- Created: 2025-01-05
-- ============================================================================

-- 복합 unique 제약 제거
ALTER TABLE products
DROP CONSTRAINT IF EXISTS unique_user_asin;

-- ASIN만 unique 제약 복원 (중복 스크래핑 방지)
ALTER TABLE products
ADD CONSTRAINT unique_asin UNIQUE(asin);

-- 인덱스 설명 추가
COMMENT ON CONSTRAINT unique_asin ON products IS 'ASIN 고유 제약 (전역적으로 중복 스크래핑 방지)';

