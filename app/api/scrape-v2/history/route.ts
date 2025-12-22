/**
 * @file app/api/scrape-v2/history/route.ts
 * @description 수집 이력 조회 API
 * 
 * 현재 사용자의 수집 이력을 조회합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: '인증이 필요합니다.',
        } satisfies ApiResponse,
        { status: 401 }
      );
    }

    // 2. 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 3. Supabase 클라이언트 생성
    const supabase = getServiceRoleClient();

    // 4. 수집 이력 조회
    const { data: jobs, error } = await supabase
      .from('scraping_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('수집 이력 조회 실패:', error);
      return NextResponse.json(
        {
          success: false,
          error: '수집 이력을 조회하는 중 오류가 발생했습니다.',
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: jobs || [],
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('수집 이력 조회 중 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '서버 오류가 발생했습니다.',
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

