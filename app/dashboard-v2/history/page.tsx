/**
 * @file app/dashboard-v2/history/page.tsx
 * @description History 페이지 (v1.1)
 * 
 * 수집 및 등록 이력 조회 페이지
 * - 수집 이력 조회 (scraping_jobs 테이블)
 * - 등록 이력 조회 (products 테이블의 status='uploaded')
 * - 날짜별 필터링
 * - 통계 정보 표시
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ApiResponse } from '@/types';

interface ScrapingJob {
  id: string;
  user_id: string;
  search_input: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_target: number;
  current_count: number;
  success_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ProductHistory {
  id: string;
  title: string;
  asin: string;
  status: 'draft' | 'uploaded' | 'error';
  created_at: string;
  updated_at: string;
}

export default function HistoryPage() {
  const [scrapingJobs, setScrapingJobs] = useState<ScrapingJob[]>([]);
  const [uploadedProducts, setUploadedProducts] = useState<ProductHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scraping' | 'upload'>('scraping');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 수집 이력 조회
      const jobsResponse = await fetch('/api/scrape-v2/history');
      const jobsData: ApiResponse<ScrapingJob[]> = await jobsResponse.json();

      if (jobsResponse.ok && jobsData.success && jobsData.data) {
        setScrapingJobs(jobsData.data);
      }

      // 등록 이력 조회
      const productsResponse = await fetch('/api/products?status=uploaded&limit=100');
      const productsData: ApiResponse<{
        products: ProductHistory[];
        total: number;
      }> = await productsResponse.json();

      if (productsResponse.ok && productsData.success && productsData.data) {
        setUploadedProducts(productsData.data.products);
      }
    } catch (err) {
      console.error('이력 조회 오류:', err);
      setError('이력을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt || !completedAt) return '-';
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    const diff = Math.floor((end - start) / 1000 / 60); // 분 단위
    if (diff < 60) return `${diff}m`;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes}m`;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      pending: {
        label: 'Pending',
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      },
      running: {
        label: 'Running',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      },
      completed: {
        label: 'Completed',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      },
      failed: {
        label: 'Failed',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      },
      cancelled: {
        label: 'Cancelled',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      },
      uploaded: {
        label: 'Uploaded',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      },
      draft: {
        label: 'Draft',
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      },
      error: {
        label: 'Error',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      },
    };

    const statusConfig = config[status] || config.pending;

    return (
      <span
        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-none ${statusConfig.className}`}
      >
        {statusConfig.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">History</h1>
        <p className="text-muted-foreground">
          Scraping & Upload History
        </p>
      </div>

      {/* 탭 메뉴 */}
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('scraping')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'scraping'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Scraping History ({scrapingJobs.length})
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'upload'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Upload History ({uploadedProducts.length})
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-none">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* 수집 이력 */}
      {activeTab === 'scraping' && (
        <div className="space-y-4">
          {scrapingJobs.length === 0 ? (
            <div className="p-6 bg-card rounded-none border text-center">
              <p className="text-muted-foreground">No scraping history available.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm font-semibold">Date</th>
                    <th className="text-left p-3 text-sm font-semibold">Keyword/URL</th>
                    <th className="text-left p-3 text-sm font-semibold">Status</th>
                    <th className="text-left p-3 text-sm font-semibold">Progress</th>
                    <th className="text-left p-3 text-sm font-semibold">Success/Failed</th>
                    <th className="text-left p-3 text-sm font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapingJobs.map((job) => (
                    <tr key={job.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-3 text-sm">{formatDate(job.created_at)}</td>
                      <td className="p-3 text-sm">
                        <div className="max-w-xs truncate" title={job.search_input}>
                          {job.search_input}
                        </div>
                      </td>
                      <td className="p-3">{getStatusBadge(job.status)}</td>
                      <td className="p-3 text-sm">
                        {job.current_count} / {job.total_target}
                      </td>
                      <td className="p-3 text-sm">
                        <span className="text-green-600 dark:text-green-400">
                          {job.success_count}
                        </span>
                        {' / '}
                        <span className="text-red-600 dark:text-red-400">
                          {job.failed_count}
                        </span>
                      </td>
                      <td className="p-3 text-sm">
                        {formatDuration(job.started_at, job.completed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 등록 이력 */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          {uploadedProducts.length === 0 ? (
            <div className="p-6 bg-card rounded-none border text-center">
              <p className="text-muted-foreground">No upload history available.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm font-semibold">Upload Date</th>
                    <th className="text-left p-3 text-sm font-semibold">Product Name</th>
                    <th className="text-left p-3 text-sm font-semibold">ASIN</th>
                    <th className="text-left p-3 text-sm font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedProducts.map((product) => (
                    <tr key={product.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-3 text-sm">{formatDate(product.updated_at)}</td>
                      <td className="p-3 text-sm">
                        <div className="max-w-md truncate" title={product.title}>
                          {product.title}
                        </div>
                      </td>
                      <td className="p-3 text-sm font-mono">{product.asin}</td>
                      <td className="p-3">{getStatusBadge(product.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
