'use client';

import { SignedOut, SignInButton, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const pathname = usePathname();
  
  // 현재 경로에 따라 버전 표시
  const getVersion = () => {
    if (pathname?.startsWith('/dashboard-v2')) {
      return 'V2';
    } else if (pathname?.startsWith('/dashboard')) {
      return 'V1';
    }
    return 'V2'; // 기본값
  };

  const version = getVersion();

  return (
    <header className="flex justify-between items-center p-4 gap-4 h-16 max-w-7xl mx-auto">
      <Link href="/" className="text-3xl font-bold font-pixel">
       na-zak-zon {version}
      </Link>
      <div className="flex gap-4 items-center">
        <SignedIn>
          <div className="flex gap-2 items-center">
            <Link href="/dashboard">
              <Button variant={pathname?.startsWith('/dashboard-v2') ? 'ghost' : 'outline'} size="sm">
                V1
              </Button>
            </Link>
            <Link href="/dashboard-v2">
              <Button variant={pathname?.startsWith('/dashboard-v2') ? 'outline' : 'ghost'} size="sm">
                V2
              </Button>
            </Link>
          </div>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <Button>로그인</Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
};

export default Navbar;
