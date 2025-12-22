-- ============================================================================
-- Migration: Create users table
-- Description: Clerk 인증과 연동되는 사용자 정보를 저장하는 테이블
-- Created: 2024-12-03
-- ============================================================================

-- Users 테이블 생성
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clerk_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 테이블 소유자 설정
ALTER TABLE public.users OWNER TO postgres;

-- Row Level Security (RLS) 비활성화
-- 개발 단계에서는 RLS를 끄고, 프로덕션에서는 활성화하는 것을 권장합니다
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON public.users(clerk_id);

-- 테이블 설명 (주석)
COMMENT ON TABLE public.users IS 'Clerk 인증과 연동되는 사용자 정보를 저장하는 테이블';
COMMENT ON COLUMN public.users.clerk_id IS 'Clerk User ID (고유값)';
COMMENT ON COLUMN public.users.name IS '사용자 이름 (fullName, username, 또는 email)';

