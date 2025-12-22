-- ============================================================================
-- Migration: Add paused status to scraping_jobs table
-- Description: 수집 중지 및 재개 기능을 위한 paused 상태 추가
-- Created: 2025-01-04
-- ============================================================================

-- 기존 제약 조건 삭제
ALTER TABLE scraping_jobs DROP CONSTRAINT IF EXISTS valid_status;

-- paused 상태를 포함한 새로운 제약 조건 추가
ALTER TABLE scraping_jobs 
  ADD CONSTRAINT valid_status 
  CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled'));

-- 테이블 설명 업데이트
COMMENT ON COLUMN scraping_jobs.status IS '작업 상태: pending (대기), running (진행 중), paused (일시 중지), completed (완료), failed (실패), cancelled (취소)';

