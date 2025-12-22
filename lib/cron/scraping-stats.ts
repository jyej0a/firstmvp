/**
 * @file lib/cron/scraping-stats.ts
 * @description 수집 현황 조회 및 Discord 알림 전송
 * 
 * 개발 환경에서 서버가 실행 중일 때만 동작하는 백그라운드 작업
 */

import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { sendDiscord } from '@/lib/discord';

/**
 * 오늘 날짜 기준 수집 현황을 조회하고 Discord로 전송합니다.
 */
export async function sendScrapingStats(): Promise<void> {
  try {
    const supabase = getServiceRoleClient();
    
    // 오늘 날짜 기준 (한국 시간 기준)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // 오늘 날짜 기준으로 스크래핑 작업 통계 조회
    const { data: todayJobs, error } = await supabase
      .from('scraping_jobs')
      .select('success_count, failed_count, status, created_at')
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', todayEnd.toISOString());

    if (error) {
      console.error('[Cron] 통계 조회 실패:', error);
      return;
    }

    // 통계 계산
    const totalSuccess = todayJobs?.reduce((sum, job) => sum + (job.success_count || 0), 0) || 0;
    const totalFailed = todayJobs?.reduce((sum, job) => sum + (job.failed_count || 0), 0) || 0;
    const runningJobs = todayJobs?.filter(job => job.status === 'running').length || 0;
    const completedJobs = todayJobs?.filter(job => job.status === 'completed').length || 0;
    const failedJobs = todayJobs?.filter(job => job.status === 'failed').length || 0;

    // 날짜 포맷팅 (예: 2024-12-22)
    const dateStr = today.toISOString().split('T')[0];

    // Discord 메시지 생성
    const message = `📊 **${dateStr} 기준 수집 현황**\n\n` +
      `✅ 성공: ${totalSuccess}건\n` +
      `❌ 실패: ${totalFailed}건\n` +
      `\n` +
      `📋 작업 상태:\n` +
      `- 진행 중: ${runningJobs}개\n` +
      `- 완료: ${completedJobs}개\n` +
      `- 실패: ${failedJobs}개`;

    // Discord로 전송
    await sendDiscord({ content: message });
    
    console.log(`[Cron] 수집 현황 알림 전송 완료: ${dateStr}`);
  } catch (error) {
    console.error('[Cron] 수집 현황 알림 전송 실패:', error);
  }
}

/**
 * 백그라운드 작업 시작
 * 4시간마다 수집 현황을 Discord로 전송합니다.
 */
export function startScrapingStatsCron(): void {
  // 개발 환경에서만 실행
  if (process.env.NODE_ENV !== 'development') {
    console.log('[Cron] 개발 환경이 아니므로 백그라운드 작업을 시작하지 않습니다.');
    return;
  }

  console.log('[Cron] 수집 현황 알림 백그라운드 작업 시작 (4시간마다 실행)');
  
  // 즉시 한 번 실행
  sendScrapingStats().catch(console.error);
  
  // 4시간마다 실행 (밀리초: 4 * 60 * 60 * 1000)
  const intervalMs = 4 * 60 * 60 * 1000;
  
  setInterval(() => {
    sendScrapingStats().catch(console.error);
  }, intervalMs);
}

