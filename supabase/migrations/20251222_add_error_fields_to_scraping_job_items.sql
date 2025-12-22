alter table public.scraping_job_items
  add column if not exists error_code text,
  add column if not exists error_reason text,
  add column if not exists error_detail text,
  add column if not exists failed_at timestamptz;

create index if not exists idx_scraping_job_items_error_code
  on public.scraping_job_items (error_code);

create index if not exists idx_scraping_job_items_failed_at
  on public.scraping_job_items (failed_at);
