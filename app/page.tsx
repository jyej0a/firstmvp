import { redirect } from 'next/navigation';

export default function Home() {
  // 메인 페이지 접속 시 대시보드로 리디렉션
  redirect('/dashboard');
}
