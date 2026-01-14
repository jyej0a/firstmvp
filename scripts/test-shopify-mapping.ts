/**
 * Shopify 매핑 테스트
 * 
 * Variants와 Category가 Shopify에 올바르게 매핑되는지 테스트합니다.
 */

import type { Product } from '@/types';

// formatProductForShopify 함수를 가져옴 (export 되어있지 않으므로 직접 import 불가)
// 대신 테스트용 함수를 만들어서 동일한 로직을 사용

function testShopifyMapping() {
  console.log('🧪 Shopify 매핑 테스트\n');
  console.log('='.repeat(70));

  // 테스트 데이터 1: Variants 있는 상품 (FREEORR 립스틱)
  const testProduct1: Partial<Product> = {
    id: 1,
    asin: 'B0G6419DPJ',
    title: 'FREEORR Lipstick',
    description: 'Hydrating Lightweight Finish Lipstick Set',
    price: 9.99,
    sellingPrice: 9.99,
    category: 'Beauty & Personal Care > Makeup > Lips > Lipstick',
    brand: 'FREEORR',
    variants: ['Color: Set A'], // 배열 형태
    images: ['https://example.com/image1.jpg'],
    sourcingType: 'auto',
  };

  console.log('\n📦 테스트 상품 1: FREEORR 립스틱');
  console.log('  - ASIN:', testProduct1.asin);
  console.log('  - Title:', testProduct1.title);
  console.log('  - Category:', testProduct1.category);
  console.log('  - Brand:', testProduct1.brand);
  console.log('  - Variants:', JSON.stringify(testProduct1.variants));

  // Variants 파싱 시뮬레이션
  console.log('\n🔄 Variants 파싱:');
  
  if (testProduct1.variants && Array.isArray(testProduct1.variants)) {
    testProduct1.variants.forEach((variant, index) => {
      const colonIndex = variant.indexOf(':');
      let name = '';
      let value = '';

      if (colonIndex > -1) {
        name = variant.substring(0, colonIndex).trim();
        value = variant.substring(colonIndex + 1).trim();
      } else {
        name = `Option ${index + 1}`;
        value = variant.trim();
      }

      console.log(`  ✅ [${index}] name="${name}", value="${value}"`);
      console.log(`     → Shopify option${index + 1} = "${value}"`);
      console.log(`     → Shopify options: { name: "${name}", values: ["${value}"] }`);
    });
  }

  // Category 파싱 시뮬레이션
  console.log('\n📁 Category 파싱:');
  if (testProduct1.category) {
    const categoryParts = testProduct1.category.split(' > ');
    const productType = categoryParts[categoryParts.length - 1] || testProduct1.category;
    console.log(`  - 원본: "${testProduct1.category}"`);
    console.log(`  - 분리: ${JSON.stringify(categoryParts)}`);
    console.log(`  ✅ Shopify product_type: "${productType}"`);
  }

  // Brand 파싱
  console.log('\n🏷️  Brand 파싱:');
  const vendor = testProduct1.brand || 'Trend-Hybrid';
  console.log(`  ✅ Shopify vendor: "${vendor}"`);

  console.log('\n' + '='.repeat(70));

  // 테스트 데이터 2: 사용자가 제공한 ASIN (카테고리 테스트용)
  const testProduct2: Partial<Product> = {
    id: 2,
    asin: 'B0D3DZWXT4',
    title: 'Test Product',
    description: 'Test Description',
    price: 19.99,
    sellingPrice: 19.99,
    category: 'Electronics > Computers & Accessories > Computer Accessories',
    brand: 'TestBrand',
    variants: undefined, // 옵션 없음
    images: ['https://example.com/image2.jpg'],
    sourcingType: 'auto',
  };

  console.log('\n📦 테스트 상품 2: B0D3DZWXT4');
  console.log('  - ASIN:', testProduct2.asin);
  console.log('  - Title:', testProduct2.title);
  console.log('  - Category:', testProduct2.category);
  console.log('  - Brand:', testProduct2.brand);
  console.log('  - Variants:', testProduct2.variants || 'null');

  // Category 파싱
  console.log('\n📁 Category 파싱:');
  if (testProduct2.category) {
    const categoryParts = testProduct2.category.split(' > ');
    const productType = categoryParts[categoryParts.length - 1] || testProduct2.category;
    console.log(`  - 원본: "${testProduct2.category}"`);
    console.log(`  - 분리: ${JSON.stringify(categoryParts)}`);
    console.log(`  ✅ Shopify product_type: "${productType}"`);
  }

  console.log('\n' + '='.repeat(70));

  // 예상 Shopify API 요청 형태 출력
  console.log('\n📤 예상 Shopify API 요청 (상품 1):');
  console.log(JSON.stringify({
    product: {
      title: testProduct1.title,
      body_html: testProduct1.description,
      vendor: testProduct1.brand,
      product_type: 'Lipstick',
      status: 'draft',
      options: [
        {
          name: 'Color',
          values: ['Set A'],
        },
      ],
      variants: [
        {
          price: '9.99',
          sku: testProduct1.asin,
          option1: 'Set A',
          inventory_quantity: 0,
        },
      ],
      tags: `amazon,${testProduct1.sourcingType},asin:${testProduct1.asin}`,
    },
  }, null, 2));

  console.log('\n✅ 테스트 완료!');
  console.log('\n💡 결론:');
  console.log('  1. Variants는 "Color: Set A" 형태로 저장되며, Shopify에서는:');
  console.log('     - options: { name: "Color", values: ["Set A"] }');
  console.log('     - variant.option1: "Set A"');
  console.log('  2. Category는 마지막 부분만 product_type으로 사용됩니다.');
  console.log('     - "A > B > C" → product_type: "C"');
  console.log('  3. Brand는 vendor로 매핑됩니다.');
}

testShopifyMapping();
