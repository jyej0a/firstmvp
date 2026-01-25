/**
 * @file app/dashboard-v2/layout.tsx
 * @description Dashboard V2 공통 레이아웃 (사이드바 포함)
 * 
 * 모든 dashboard-v2 하위 페이지에서 공통으로 사용되는 사이드바 레이아웃
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

export default function DashboardV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // 메뉴 항목 정의
  const menuItems = [
    { href: '/dashboard-v2/scrape', label: 'Start.' },
    { href: '/dashboard-v2', label: 'Dashboard' },
    { href: '/dashboard-v2/products', label: 'Product List' },
    { href: '/dashboard-v2/margin-rate', label: 'Margin Rate' },
    { href: '/dashboard-v2/editor', label: 'Editor' },
    { href: '/dashboard-v2/history', label: 'History' },
    { href: '/dashboard-v2/presentation', label: 'Presentation' },
  ];

  return (
    <div className="flex min-h-screen bg-terminal">
      {/* 왼쪽 사이드바 */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-50 transition-transform duration-300 flex flex-col ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* 사이드바 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2 className="text-xl font-bold pt-2">Nav</h2>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 메뉴 항목 */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`w-full block text-left px-4 py-3 rounded-none transition-colors text-sm font-medium ${
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* 오버레이 (모바일용) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 메인 컨텐츠 */}
      <div className="flex-1 lg:ml-64">
        {/* 햄버거 메뉴 버튼 (모바일용) */}
        <div className="lg:hidden fixed top-4 left-4 z-30">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

