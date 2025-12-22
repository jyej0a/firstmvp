/**
 * @file lib/scripts/scraping-stats-cron.ts
 * @description 수집 현황 알림 백그라운드 작업 스크립트
 * 
 * 개발 환경에서 별도 프로세스로 실행하여 4시간마다 알림을 전송합니다.
 */

import "dotenv/config";
import { startScrapingStatsCron } from '@/lib/cron/scraping-stats';

console.log('📊 수집 현황 알림 백그라운드 작업 시작...');
console.log('4시간마다 Discord로 알림을 전송합니다.');
console.log('종료하려면 Ctrl+C를 누르세요.\n');

startScrapingStatsCron();

// 프로세스가 종료되지 않도록 유지
process.on('SIGINT', () => {
  console.log('\n📊 백그라운드 작업 종료');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n📊 백그라운드 작업 종료');
  process.exit(0);
});

