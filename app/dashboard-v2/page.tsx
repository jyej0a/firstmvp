/**
 * @file app/dashboard-v2/page.tsx
 * @description Dashboard 페이지 (수집 현황 그래프)
 * 
 * 수집 현황을 그래프로 시각화하는 대시보드
 * - 일별 수집 현황 그래프
 * - 상태별 상품 통계
 * - 최근 수집 작업 현황
 */

'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Package, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { ApiResponse } from '@/types';

interface DashboardStats {
  products: {
    total: number;
    byStatus: {
      draft: number;
      uploaded: number;
      error: number;
    };
  };
  dailyCollection: Array<{
    date: string;
    count: number;
  }>;
  jobs: {
    total: number;
    recent: Array<{
      id: string;
      status: string;
      successCount: number;
      failedCount: number;
      productCount?: number; // Job에 속한 상품 개수 (선택사항)
      createdAt: string;
    }>;
  };
}

const COLORS = {
  draft: '#94a3b8',
  uploaded: '#22c55e',
  error: '#ef4444',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('30d');

  useEffect(() => {
    fetchStats();
    // 30초마다 자동 새로고침
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard/stats');
      const data: ApiResponse<DashboardStats> = await response.json();

      if (response.ok && data.success && data.data) {
        setStats(data.data);
      } else {
        setError(data.error || '통계를 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('통계 조회 오류:', err);
      setError('통계를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 날짜 포맷팅 (MM/DD)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 시간 범위에 따른 데이터 필터링
  const filteredDailyData = stats?.dailyCollection
    ? timeRange === '7d'
      ? stats.dailyCollection.slice(-7)
      : stats.dailyCollection
    : [];

  // 상태별 파이 차트 데이터
  const statusChartData = stats
    ? [
        { name: 'Draft', value: stats.products.byStatus.draft, color: COLORS.draft },
        { name: 'Uploaded', value: stats.products.byStatus.uploaded, color: COLORS.uploaded },
        { name: 'Error', value: stats.products.byStatus.error, color: COLORS.error },
      ].filter((item) => item.value > 0)
    : [];

  if (isLoading && !stats) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <p className="text-muted-foreground">통계를 불러오는 중...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="p-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-none">
          <p className="text-red-700 dark:text-red-300">{error || '통계를 불러올 수 없습니다.'}</p>
          <Button onClick={fetchStats} className="mt-4" variant="outline">
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Collection Status & Statistics
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 총 상품 수 */}
        <div className="p-6 bg-card rounded-none border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Products</p>
              <p className="text-3xl font-bold">{stats.products.total.toLocaleString()}</p>
            </div>
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        {/* Draft */}
        <div className="p-6 bg-card rounded-none border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Draft</p>
              <p className="text-3xl font-bold" style={{ color: COLORS.draft }}>
                {stats.products.byStatus.draft.toLocaleString()}
              </p>
            </div>
            <Clock className="h-8 w-8" style={{ color: COLORS.draft }} />
          </div>
        </div>

        {/* Uploaded */}
        <div className="p-6 bg-card rounded-none border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Uploaded</p>
              <p className="text-3xl font-bold" style={{ color: COLORS.uploaded }}>
                {stats.products.byStatus.uploaded.toLocaleString()}
              </p>
            </div>
            <CheckCircle className="h-8 w-8" style={{ color: COLORS.uploaded }} />
          </div>
        </div>

        {/* Error */}
        <div className="p-6 bg-card rounded-none border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Error</p>
              <p className="text-3xl font-bold" style={{ color: COLORS.error }}>
                {stats.products.byStatus.error.toLocaleString()}
              </p>
            </div>
            <XCircle className="h-8 w-8" style={{ color: COLORS.error }} />
          </div>
        </div>
      </div>

      {/* 그래프 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 일별 수집 현황 (라인 차트) */}
        <div className="p-6 bg-card rounded-none border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Daily Collection</h2>
            <div className="flex gap-2">
              <Button
                variant={timeRange === '7d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('7d')}
              >
                7 Days
              </Button>
              <Button
                variant={timeRange === '30d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('30d')}
              >
                30 Days
              </Button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={filteredDailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(label) => `Date: ${label}`}
                formatter={(value: number) => [`${value} items`, 'Collected']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#22c55e"
                strokeWidth={2}
                name="Products Collected"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 상태별 분포 (파이 차트) */}
        <div className="p-6 bg-card rounded-none border">
          <h2 className="text-lg font-semibold mb-4">Status Distribution</h2>
          {statusChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value} items`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* 최근 수집 작업 */}
      <div className="mb-6 p-6 bg-card rounded-none border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Jobs</h2>
          <Link href="/dashboard-v2/history">
            <Button variant="outline" size="sm">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
        {stats.jobs.recent.length > 0 ? (
          <div className="space-y-2">
            {stats.jobs.recent.map((job, index) => (
              <div
                key={job.id || `job-${index}`}
                className="flex items-center justify-between p-3 border border-border rounded-none hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-none ${
                      job.status === 'completed'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : job.status === 'running'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                        : job.status === 'failed'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {job.status}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString('en-US')}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {job.productCount !== undefined && (
                    <span className="text-muted-foreground">
                      Products: {job.productCount}
                    </span>
                  )}
                  <span className="text-green-600 dark:text-green-400">
                    Success: {job.successCount}
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    Failed: {job.failedCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No recent jobs</p>
        )}
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/dashboard-v2/scrape">
          <div className="p-6 bg-card rounded-none border hover:bg-muted/50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Start.</h3>
                <p className="text-sm text-muted-foreground">
                  Begin collecting new products
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
        </Link>

        <Link href="/dashboard-v2/products">
          <div className="p-6 bg-card rounded-none border hover:bg-muted/50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Product List</h3>
                <p className="text-sm text-muted-foreground">
                  Manage collected products
                </p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
