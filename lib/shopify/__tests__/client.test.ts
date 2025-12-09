/**
 * @file lib/shopify/__tests__/client.test.ts
 * @description Shopify API 클라이언트 단위 테스트
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createProduct } from "../client";
import type { Product } from "@/types";

// 환경변수 모킹
const mockEnv = {
  SHOPIFY_STORE_URL: "https://test-store.myshopify.com",
  SHOPIFY_ACCESS_TOKEN: "test-token-123",
  SHOPIFY_API_VERSION: "2025-01",
};

beforeEach(() => {
  // 환경변수 설정
  process.env.SHOPIFY_STORE_URL = mockEnv.SHOPIFY_STORE_URL;
  process.env.SHOPIFY_ACCESS_TOKEN = mockEnv.SHOPIFY_ACCESS_TOKEN;
  process.env.SHOPIFY_API_VERSION = mockEnv.SHOPIFY_API_VERSION;

  // fetch 모킹 초기화
  vi.clearAllMocks();
});

describe("createProduct", () => {
  const mockProduct: Product = {
    id: "test-id-1",
    userId: "user-123",
    asin: "B08TEST123",
    sourceUrl: "https://amazon.com/dp/B08TEST123",
    title: "Test Product - Wireless Earbuds",
    description: "High quality wireless earbuds",
    images: [
      "https://m.media-amazon.com/images/I/test1.jpg",
      "https://m.media-amazon.com/images/I/test2.jpg",
    ],
    variants: null,
    sourcingType: "US",
    amazonPrice: 29.99,
    costPrice: null,
    shippingCost: null,
    extraCost: null,
    marginRate: 40,
    sellingPrice: 41.99,
    status: "draft",
    errorMessage: null,
    createdAt: "2024-12-09T00:00:00Z",
    updatedAt: "2024-12-09T00:00:00Z",
  };

  describe("성공 케이스", () => {
    it("상품 생성에 성공하면 shopifyProductId를 반환해야 함", async () => {
      const mockResponse = {
        product: {
          id: 123456789,
          title: mockProduct.title,
          handle: "test-product-wireless-earbuds",
          body_html: mockProduct.description,
          vendor: "Trend-Hybrid",
          product_type: "General",
          status: "draft",
          images: [],
          variants: [],
          created_at: "2024-12-09T00:00:00Z",
          updated_at: "2024-12-09T00:00:00Z",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const result = await createProduct(mockProduct);

      expect(result.success).toBe(true);
      expect(result.shopifyProductId).toBe(123456789);
      expect(result.error).toBeUndefined();
    });

    it("fetch가 올바른 URL과 헤더로 호출되어야 함", async () => {
      const mockResponse = {
        product: {
          id: 123456789,
          title: mockProduct.title,
          handle: "test",
          body_html: "",
          vendor: "",
          product_type: "",
          status: "draft",
          images: [],
          variants: [],
          created_at: "",
          updated_at: "",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      await createProduct(mockProduct);

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockEnv.SHOPIFY_STORE_URL}/admin/api/${mockEnv.SHOPIFY_API_VERSION}/products.json`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": mockEnv.SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("이미지가 올바르게 변환되어 전송되어야 함", async () => {
      const mockResponse = {
        product: {
          id: 123456789,
          title: "",
          handle: "",
          body_html: "",
          vendor: "",
          product_type: "",
          status: "draft",
          images: [],
          variants: [],
          created_at: "",
          updated_at: "",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      await createProduct(mockProduct);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.product.images).toHaveLength(2);
      expect(requestBody.product.images[0]).toEqual({
        src: mockProduct.images[0],
        alt: mockProduct.title,
        position: 1,
      });
    });

    it("가격이 올바르게 포맷팅되어 전송되어야 함", async () => {
      const mockResponse = {
        product: {
          id: 123456789,
          title: "",
          handle: "",
          body_html: "",
          vendor: "",
          product_type: "",
          status: "draft",
          images: [],
          variants: [],
          created_at: "",
          updated_at: "",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      await createProduct(mockProduct);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.product.variants[0].price).toBe("41.99");
    });
  });

  describe("에러 케이스", () => {
    it("환경변수가 없으면 에러를 반환해야 함", async () => {
      delete process.env.SHOPIFY_STORE_URL;

      const result = await createProduct(mockProduct);

      expect(result.success).toBe(false);
      expect(result.error).toContain("SHOPIFY_STORE_URL");
    });

    it("401 에러 시 Access Token 오류 메시지를 반환해야 함", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      });

      const result = await createProduct(mockProduct);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access Token");
      expect(result.statusCode).toBe(401);
    });

    it("422 에러 시 유효성 오류 메시지를 반환해야 함", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          errors: { title: ["can't be blank"] },
        }),
      });

      const result = await createProduct(mockProduct);

      expect(result.success).toBe(false);
      expect(result.error).toContain("유효성 오류");
      expect(result.statusCode).toBe(422);
    });

    it("429 에러 시 재시도해야 함", async () => {
      // 첫 번째 호출은 429, 두 번째는 성공
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: "Rate limit exceeded" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            product: {
              id: 123456789,
              title: "",
              handle: "",
              body_html: "",
              vendor: "",
              product_type: "",
              status: "draft",
              images: [],
              variants: [],
              created_at: "",
              updated_at: "",
            },
          }),
        });

      const result = await createProduct(mockProduct);

      // 재시도 로직이 작동하면 결국 성공해야 함
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, 10000); // 재시도 대기 시간 고려하여 타임아웃 증가

    it("500 에러 시 재시도해야 함", async () => {
      // 첫 번째 호출은 500, 두 번째는 성공
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: "Internal server error" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            product: {
              id: 123456789,
              title: "",
              handle: "",
              body_html: "",
              vendor: "",
              product_type: "",
              status: "draft",
              images: [],
              variants: [],
              created_at: "",
              updated_at: "",
            },
          }),
        });

      const result = await createProduct(mockProduct);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, 10000);
  });

  describe("이미지 처리", () => {
    it("10개 이상의 이미지는 첫 10개만 전송해야 함", async () => {
      const productWith15Images = {
        ...mockProduct,
        images: Array(15).fill("https://example.com/image.jpg"),
      };

      const mockResponse = {
        product: {
          id: 123456789,
          title: "",
          handle: "",
          body_html: "",
          vendor: "",
          product_type: "",
          status: "draft",
          images: [],
          variants: [],
          created_at: "",
          updated_at: "",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      await createProduct(productWith15Images);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.product.images).toHaveLength(10);
    });

    it("이미지가 없어도 에러 없이 처리되어야 함", async () => {
      const productNoImages = {
        ...mockProduct,
        images: [],
      };

      const mockResponse = {
        product: {
          id: 123456789,
          title: "",
          handle: "",
          body_html: "",
          vendor: "",
          product_type: "",
          status: "draft",
          images: [],
          variants: [],
          created_at: "",
          updated_at: "",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const result = await createProduct(productNoImages);

      expect(result.success).toBe(true);
    });
  });
});

