-- scraping_jobs 테이블에 scraping_mode 컬럼 추가
-- 수집 모드: collect_only (수집만), collect_sync (자동 등록)

ALTER TABLE scraping_jobs
ADD COLUMN scraping_mode TEXT NOT NULL DEFAULT 'collect_sync'
CHECK (scraping_mode IN ('collect_only', 'collect_sync'));

-- 컬럼에 대한 설명 추가
COMMENT ON COLUMN scraping_jobs.scraping_mode IS 
'수집 모드: collect_only (수집만), collect_sync (자동 등록)';
