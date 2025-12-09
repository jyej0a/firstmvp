import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 보호할 라우트 정의: 로그인이 필요한 페이지/API
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)", // 대시보드 (모든 하위 경로 포함)
  "/api/scrape(.*)", // 스크래핑 API
  "/api/sync-user(.*)", // 사용자 동기화 API
]);

export default clerkMiddleware(async (auth, req) => {
  // 보호된 라우트에 접근 시 로그인 강제
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
