-- ============================================================================
-- Migration: Fix products unique constraint
-- Description: ASIN만 unique 제약을 user_id + asin 복합 unique로 변경
-- Created: 2025-01-05
-- ============================================================================

-- 기존 unique_asin 제약 제거
ALTER TABLE products
DROP CONSTRAINT IF EXISTS unique_asin;

-- user_id + asin 복합 unique 제약 추가 (같은 사용자가 같은 ASIN을 중복 저장하지 못하도록)
ALTER TABLE products
ADD CONSTRAINT unique_user_asin UNIQUE(user_id, asin);

-- 인덱스 설명 추가
COMMENT ON CONSTRAINT unique_user_asin ON products IS '사용자별 ASIN 고유 제약 (같은 사용자가 같은 ASIN을 중복 저장하지 못함)';

