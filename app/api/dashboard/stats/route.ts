/**
 * @file app/api/dashboard/stats/route.ts
 * @description Dashboard 통계 API
 * 
 * 수집 현황 및 상품 통계를 제공합니다.
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

    const supabase = getServiceRoleClient();

    // 2. 전체 상품 통계
    const { count: totalProducts, error: productsError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (productsError) {
      console.error('상품 통계 조회 실패:', productsError);
    }

    // 3. 상태별 상품 통계
    const { data: statusStats, error: statusError } = await supabase
      .from('products')
      .select('status')
      .eq('user_id', userId);

    const statusCounts = {
      draft: 0,
      uploaded: 0,
      error: 0,
    };

    if (statusStats) {
      statusStats.forEach((product: { status: string }) => {
        if (product.status === 'draft') statusCounts.draft++;
        else if (product.status === 'uploaded') statusCounts.uploaded++;
        else if (product.status === 'error') statusCounts.error++;
      });
    }

    // 4. 최근 30일 일별 수집 현황
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentProducts, error: recentError } = await supabase
      .from('products')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    // 일별 그룹화
    const dailyStats: Record<string, number> = {};
    if (recentProducts) {
      recentProducts.forEach((product: { created_at: string }) => {
        const date = new Date(product.created_at).toISOString().split('T')[0];
        dailyStats[date] = (dailyStats[date] || 0) + 1;
      });
    }

    // 최근 30일 날짜 배열 생성 (빈 날짜도 포함)
    const dateArray: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dateArray.push({
        date: dateStr,
        count: dailyStats[dateStr] || 0,
      });
    }

    // 5. 수집 작업 통계
    const { count: totalJobs, error: jobsError } = await supabase
      .from('scraping_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 최근 7일 수집 작업 현황
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentJobs, error: recentJobsError } = await supabase
      .from('scraping_jobs')
      .select('status, success_count, failed_count, created_at')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // 6. 최근 수집 작업 요약
    const recentJobsSummary = recentJobs?.map((job: any) => ({
      id: job.id,
      status: job.status,
      successCount: job.success_count || 0,
      failedCount: job.failed_count || 0,
      createdAt: job.created_at,
    })) || [];

    return NextResponse.json(
      {
        success: true,
        data: {
          products: {
            total: totalProducts || 0,
            byStatus: statusCounts,
          },
          dailyCollection: dateArray,
          jobs: {
            total: totalJobs || 0,
            recent: recentJobsSummary,
          },
        },
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('통계 조회 중 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '서버 오류가 발생했습니다.',
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

