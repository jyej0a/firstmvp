/**
 * @file lib/test-products-api.ts
 * @description 상품 조회 API 테스트 스크립트
 * 
 * 실행 방법: 브라우저 콘솔에서
 * ```
 * fetch('/api/products').then(r => r.json()).then(console.log)
 * ```
 */

export async function testProductsAPI() {
  console.group("🧪 상품 조회 API 테스트");

  try {
    console.log("📡 GET /api/products 요청 전송...");

    const response = await fetch("/api/products", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    console.log("📦 응답 상태:", response.status);
    console.log("📦 응답 데이터:", data);

    if (response.ok && data.success) {
      console.log("✅ 테스트 성공!");
      console.log(`   - 총 상품: ${data.data.total}개`);
      console.log(`   - 조회된 상품: ${data.data.products.length}개`);
      console.log(`   - Limit: ${data.data.limit}`);
      console.log(`   - Offset: ${data.data.offset}`);

      if (data.data.products.length > 0) {
        console.log("   - 첫 번째 상품:", {
          asin: data.data.products[0].asin,
          title: data.data.products[0].title.substring(0, 50) + "...",
          price: data.data.products[0].sellingPrice,
          status: data.data.products[0].status,
        });
      }
    } else {
      console.error("❌ 테스트 실패:", data.error);
    }

    console.groupEnd();
    return data;
  } catch (error) {
    console.error("❌ 테스트 중 오류:", error);
    console.groupEnd();
    throw error;
  }
}

// 페이지네이션 테스트
export async function testPagination() {
  console.group("🧪 페이지네이션 테스트");

  try {
    // 첫 5개만 조회
    console.log("📡 GET /api/products?limit=5&offset=0");
    const page1 = await fetch("/api/products?limit=5&offset=0").then(r => r.json());
    console.log("페이지 1:", {
      total: page1.data.total,
      count: page1.data.products.length,
      limit: page1.data.limit,
      offset: page1.data.offset,
    });

    // 다음 5개 조회
    console.log("📡 GET /api/products?limit=5&offset=5");
    const page2 = await fetch("/api/products?limit=5&offset=5").then(r => r.json());
    console.log("페이지 2:", {
      total: page2.data.total,
      count: page2.data.products.length,
      limit: page2.data.limit,
      offset: page2.data.offset,
    });

    console.log("✅ 페이지네이션 테스트 완료!");
    console.groupEnd();
  } catch (error) {
    console.error("❌ 페이지네이션 테스트 실패:", error);
    console.groupEnd();
  }
}
