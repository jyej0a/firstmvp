-- ============================================================================
-- Migration: Create scraping_jobs and scraping_job_items tables
-- Description: 순차 처리 스크래핑 작업을 추적하기 위한 테이블
-- Created: 2024-12-15
-- ============================================================================

-- Scraping Jobs 테이블 생성
CREATE TABLE IF NOT EXISTS scraping_jobs (
  -- 기본 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 사용자 정보
  user_id TEXT NOT NULL,  -- Clerk User ID
  
  -- 작업 정보
  search_input TEXT NOT NULL,  -- 사용자 입력값 (키워드 또는 URL)
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, cancelled
  total_target INTEGER NOT NULL DEFAULT 1000,  -- 목표 개수 (하루 최대 1000개)
  current_count INTEGER NOT NULL DEFAULT 0,  -- 현재 수집된 개수
  success_count INTEGER NOT NULL DEFAULT 0,  -- 성공한 개수
  failed_count INTEGER NOT NULL DEFAULT 0,  -- 실패한 개수
  
  -- 타임스탬프
  started_at TIMESTAMPTZ,  -- 작업 시작 시간
  completed_at TIMESTAMPTZ,  -- 작업 완료 시간 (nullable)
  error_message TEXT,  -- 에러 발생 시 메시지 (nullable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 제약 조건
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT positive_total_target CHECK (total_target > 0),
  CONSTRAINT non_negative_counts CHECK (current_count >= 0 AND success_count >= 0 AND failed_count >= 0)
);

-- Scraping Job Items 테이블 생성 (각 상품별 상세 정보)
CREATE TABLE IF NOT EXISTS scraping_job_items (
  -- 기본 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 외래 키
  job_id UUID NOT NULL REFERENCES scraping_jobs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,  -- products 테이블과 연결 (nullable)
  
  -- 상품 정보
  asin TEXT NOT NULL,  -- 아마존 상품 식별자
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, scraping, saved, registered, failed
  error_message TEXT,  -- 에러 발생 시 메시지 (nullable)
  
  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 제약 조건
  CONSTRAINT valid_item_status CHECK (status IN ('pending', 'scraping', 'saved', 'registered', 'failed'))
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_user_id ON scraping_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_created_at ON scraping_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scraping_job_items_job_id ON scraping_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_scraping_job_items_status ON scraping_job_items(status);
CREATE INDEX IF NOT EXISTS idx_scraping_job_items_asin ON scraping_job_items(asin);

-- updated_at 자동 업데이트 트리거 (기존 함수 재사용)
CREATE TRIGGER update_scraping_jobs_updated_at
  BEFORE UPDATE ON scraping_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scraping_job_items_updated_at
  BEFORE UPDATE ON scraping_job_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 테이블 설명 (주석)
COMMENT ON TABLE scraping_jobs IS '순차 처리 스크래핑 작업을 추적하는 테이블';
COMMENT ON TABLE scraping_job_items IS '각 스크래핑 작업의 상품별 상세 정보를 저장하는 테이블';
COMMENT ON COLUMN scraping_jobs.status IS '작업 상태: pending (대기), running (진행 중), completed (완료), failed (실패), cancelled (취소)';
COMMENT ON COLUMN scraping_job_items.status IS '상품 상태: pending (대기), scraping (수집 중), saved (DB 저장 완료), registered (Shopify 등록 완료), failed (실패)';
