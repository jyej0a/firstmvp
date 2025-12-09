/**
 * @file app/api/products/[id]/route.ts
 * @description 상품 업데이트 API
 *
 * 이 API는 개별 상품의 정보를 업데이트합니다.
 * 주요 사용 사례: 마진율 변경 시 판매가 자동 재계산 및 저장
 *
 * Endpoints:
 * - PATCH /api/products/[id] - 상품 정보 업데이트
 * - GET /api/products/[id] - 상품 상세 조회
 * - DELETE /api/products/[id] - 상품 삭제
 *
 * @see {@link /docs/TODO.md#2.16} - 구현 계획
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkSupabaseClient } from "@/lib/supabase/server";
import { calculatePrice } from "@/lib/pricing/calculator";
import type { ApiResponse, Product } from "@/types";

/**
 * 상품 업데이트 요청 바디
 */
interface UpdateProductBody {
  /** 마진율 (0-100) */
  marginRate?: number;

  /** 상품명 (선택사항) */
  title?: string;

  /** 상품 설명 (선택사항) */
  description?: string;

  /** 상태 (선택사항) */
  status?: "draft" | "uploaded" | "error";
}

/**
 * GET 요청 핸들러 - 상품 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "인증이 필요합니다.",
        } satisfies ApiResponse,
        { status: 401 }
      );
    }

    // 2. 상품 ID 추출
    const { id: productId } = await params;

    console.log(`🔍 상품 조회 요청: ${productId}`);

    // 3. Supabase 클라이언트 생성
    const supabase = await createClerkSupabaseClient();

    // 4. 상품 조회
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("user_id", userId)
      .single();

    if (error || !product) {
      console.error("상품 조회 실패:", error);
      return NextResponse.json(
        {
          success: false,
          error: "상품을 찾을 수 없습니다.",
        } satisfies ApiResponse,
        { status: 404 }
      );
    }

    console.log(`✅ 상품 조회 성공: ${product.title}`);

    return NextResponse.json(
      {
        success: true,
        data: product,
      } satisfies ApiResponse<Product>,
      { status: 200 }
    );
  } catch (error) {
    console.error("상품 조회 중 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다.",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * PATCH 요청 핸들러 - 상품 정보 업데이트
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.group("🔄 [API] 상품 업데이트 요청");

  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      console.error("❌ 인증 실패");
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "인증이 필요합니다.",
        } satisfies ApiResponse,
        { status: 401 }
      );
    }

    // 2. 상품 ID 추출
    const { id: productId } = await params;
    console.log(`📦 상품 ID: ${productId}`);

    // 3. 요청 바디 파싱
    const body: UpdateProductBody = await request.json();
    console.log("📝 업데이트 데이터:", body);

    // 4. Supabase 클라이언트 생성
    const supabase = await createClerkSupabaseClient();

    // 5. 기존 상품 조회
    const { data: existingProduct, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existingProduct) {
      console.error("❌ 상품 조회 실패:", fetchError);
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "상품을 찾을 수 없습니다.",
        } satisfies ApiResponse,
        { status: 404 }
      );
    }

    console.log(`✅ 기존 상품 조회 성공: ${existingProduct.title}`);

    // 6. 업데이트할 데이터 준비
    const updateData: Partial<Product> = {};

    // 마진율 업데이트 시 판매가 자동 재계산
    if (body.marginRate !== undefined) {
      console.log(`💰 마진율 변경: ${existingProduct.margin_rate}% → ${body.marginRate}%`);

      // 가격 재계산
      const priceResult = calculatePrice({
        sourcingType: existingProduct.sourcing_type as "US" | "CN",
        amazonPrice: existingProduct.amazon_price,
        costPrice: existingProduct.cost_price || undefined,
        shippingCost: existingProduct.shipping_cost || undefined,
        extraCost: existingProduct.extra_cost || undefined,
        marginRate: body.marginRate,
      });

      if (!priceResult.success) {
        console.error("❌ 가격 계산 실패:", priceResult.error);
        console.groupEnd();

        return NextResponse.json(
          {
            success: false,
            error: priceResult.error || "가격 계산에 실패했습니다.",
          } satisfies ApiResponse,
          { status: 400 }
        );
      }

      console.log(`✅ 판매가 재계산: $${existingProduct.selling_price} → $${priceResult.sellingPrice}`);

      updateData.marginRate = body.marginRate;
      updateData.sellingPrice = priceResult.sellingPrice;
    }

    // 기타 필드 업데이트
    if (body.title !== undefined) {
      updateData.title = body.title;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    // 7. 데이터베이스 업데이트
    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", productId)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError || !updatedProduct) {
      console.error("❌ 업데이트 실패:", updateError);
      console.groupEnd();

      return NextResponse.json(
        {
          success: false,
          error: "상품 업데이트에 실패했습니다.",
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    console.log("✅ 상품 업데이트 성공");
    console.groupEnd();

    return NextResponse.json(
      {
        success: true,
        data: updatedProduct,
        message: "상품이 업데이트되었습니다.",
      } satisfies ApiResponse<Product>,
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ 상품 업데이트 중 오류:", error);
    console.groupEnd();

    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다.",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE 요청 핸들러 - 상품 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "인증이 필요합니다.",
        } satisfies ApiResponse,
        { status: 401 }
      );
    }

    // 2. 상품 ID 추출
    const { id: productId } = await params;

    console.log(`🗑️  상품 삭제 요청: ${productId}`);

    // 3. Supabase 클라이언트 생성
    const supabase = await createClerkSupabaseClient();

    // 4. 상품 삭제
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("user_id", userId);

    if (error) {
      console.error("상품 삭제 실패:", error);
      return NextResponse.json(
        {
          success: false,
          error: "상품 삭제에 실패했습니다.",
        } satisfies ApiResponse,
        { status: 500 }
      );
    }

    console.log(`✅ 상품 삭제 성공: ${productId}`);

    return NextResponse.json(
      {
        success: true,
        message: "상품이 삭제되었습니다.",
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error("상품 삭제 중 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다.",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
