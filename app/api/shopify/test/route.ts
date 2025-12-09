/**
 * @file app/api/shopify/test/route.ts
 * @description Shopify API 연결 테스트 엔드포인트
 * 
 * 이 API는 Shopify 스토어와의 연결을 확인하기 위해 사용됩니다.
 * 
 * 주요 기능:
 * 1. Shopify Shop API 호출 (스토어 기본 정보 조회)
 * 2. 환경변수 설정 확인
 * 3. Access Token 유효성 검증
 * 
 * 사용법:
 * GET /api/shopify/test
 * 
 * 예상 응답:
 * - 200: 연결 성공 (스토어 정보 반환)
 * - 401: Access Token 오류
 * - 404: URL 또는 API 버전 오류
 * - 500: 서버 오류
 */

import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. 환경변수 확인
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION;

    if (!storeUrl || !accessToken || !apiVersion) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopify 환경변수가 설정되지 않았습니다.",
          missing: {
            storeUrl: !storeUrl,
            accessToken: !accessToken,
            apiVersion: !apiVersion,
          },
        },
        { status: 500 }
      );
    }

    // 2. Shopify Shop API 호출
    const url = `${storeUrl}/admin/api/${apiVersion}/shop.json`;
    console.log(`🔍 Shopify 연결 테스트 시작: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    // 3. 응답 처리
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Shopify API 오류: ${response.status} ${response.statusText}`);
      console.error(`응답 내용:`, errorText);

      return NextResponse.json(
        {
          success: false,
          error: `Shopify API 오류: ${response.status} ${response.statusText}`,
          status: response.status,
          details: errorText,
          troubleshooting: getTroubleshooting(response.status),
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`✅ Shopify 연결 성공!`);
    console.log(`스토어 이름: ${data.shop?.name}`);
    console.log(`스토어 도메인: ${data.shop?.myshopify_domain}`);

    return NextResponse.json({
      success: true,
      message: "Shopify 연결 성공!",
      shop: {
        name: data.shop?.name,
        email: data.shop?.email,
        domain: data.shop?.domain,
        myshopify_domain: data.shop?.myshopify_domain,
        currency: data.shop?.currency,
        timezone: data.shop?.timezone,
      },
      config: {
        storeUrl,
        apiVersion,
      },
    });
  } catch (error) {
    console.error("❌ Shopify 연결 테스트 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * HTTP 상태 코드별 문제 해결 가이드
 */
function getTroubleshooting(status: number): string {
  switch (status) {
    case 401:
      return "Access Token이 잘못되었거나 만료되었습니다. Shopify Admin에서 토큰을 다시 발급받으세요.";
    case 403:
      return "Access Token의 권한이 부족합니다. Admin API 권한 스코프를 확인하세요.";
    case 404:
      return "스토어 URL 또는 API 버전이 잘못되었습니다. .env 파일의 SHOPIFY_STORE_URL과 SHOPIFY_API_VERSION을 확인하세요.";
    case 429:
      return "API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.";
    default:
      return "Shopify 서버 오류입니다. 잠시 후 다시 시도하거나 Shopify Status 페이지를 확인하세요.";
  }
}
