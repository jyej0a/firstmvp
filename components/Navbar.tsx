import { SignedOut, SignInButton, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  return (
    <header className="flex justify-between items-center p-4 gap-4 h-16 max-w-7xl mx-auto">
      <Link href="/" className="text-2xl font-bold">
       V1
      </Link>
      <div className="flex gap-4 items-center">
        <SignedIn>
          <div className="flex gap-2 items-center">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                V1
              </Button>
            </Link>
            <Link href="/dashboard-v2">
              <Button variant="default" size="sm">
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
