/**
 * Variants 통합 테스트
 * 
 * 1. 실제 상품 스크래핑
 * 2. Variants 추출 확인
 * 3. Shopify 매핑 로직 검증
 * 
 * 이 스크립트는 DB에 저장하지 않고, 메모리에서만 테스트합니다.
 */

import { scrapeSingleProduct } from '../lib/scraper/amazon-scraper';
import type { Product } from '@/types';

const LIPSTICK_SEARCH_URL = 'https://www.amazon.com/s?k=lipstick';

async function testVariantsIntegration() {
  console.log('🧪 Variants 통합 테스트 시작\n');
  console.log('='.repeat(70));
  
  try {
    // 1. 실제 아마존 상품 스크래핑 (립스틱 검색 결과 3번째 상품)
    console.log('\n📍 Step 1: 아마존 상품 스크래핑');
    console.log('   - URL:', LIPSTICK_SEARCH_URL);
    console.log('   - Offset: 2 (3번째 상품)\n');
    
    const product = await scrapeSingleProduct(LIPSTICK_SEARCH_URL, 2, {
      headless: true,
      verbose: false,
      timeout: 90000,
    });

    if (!product) {
      console.error('❌ 상품 수집 실패');
      process.exit(1);
    }

    console.log('✅ 상품 수집 성공!\n');
    console.log('='.repeat(70));
    
    // 2. Variants 확인
    console.log('\n📍 Step 2: Variants 확인');
    console.log(`   - ASIN: ${product.asin}`);
    console.log(`   - 제목: ${product.title?.substring(0, 50)}...`);
    console.log(`   - 카테고리: ${product.category || 'N/A'}`);
    console.log(`   - 브랜드: ${product.brand || 'N/A'}`);
    console.log(`   - Variants: ${JSON.stringify(product.variants)}`);

    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
      console.log('\n   ✅ Variants 수집 성공!');
      product.variants.forEach((v, idx) => {
        console.log(`      [${idx}] ${v}`);
      });
    } else {
      console.log('\n   ⚠️  Variants 없음 (이 상품에 옵션이 없을 수 있음)');
    }

    console.log('\n' + '='.repeat(70));

    // 3. Shopify 매핑 시뮬레이션
    console.log('\n📍 Step 3: Shopify 매핑 시뮬레이션');
    
    // Category 매핑
    let productType = 'General';
    if (product.category && product.category !== 'General') {
      const categoryParts = product.category.split(' > ');
      productType = categoryParts[categoryParts.length - 1] || product.category;
    }
    console.log(`   - product_type: "${productType}"`);

    // Brand 매핑
    const vendor = product.brand || 'Trend-Hybrid';
    console.log(`   - vendor: "${vendor}"`);

    // Variants 매핑
    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
      console.log(`   - options:`);
      
      product.variants.forEach((variant, index) => {
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

        console.log(`      { name: "${name}", values: ["${value}"] }`);
        console.log(`   - variant.option${index + 1}: "${value}"`);
      });
    } else {
      console.log(`   - options: 없음`);
    }

    console.log('\n' + '='.repeat(70));

    // 4. 최종 결과 요약
    console.log('\n✅ 통합 테스트 완료!\n');
    console.log('📊 결과 요약:');
    console.log(`   1. 스크래핑: ${product ? '성공 ✅' : '실패 ❌'}`);
    console.log(`   2. Variants 수집: ${product.variants && product.variants.length > 0 ? '성공 ✅' : '없음 ⚠️'}`);
    console.log(`   3. Category 매핑: ${product.category ? '성공 ✅' : '없음 ⚠️'}`);
    console.log(`   4. Brand 매핑: ${product.brand ? '성공 ✅' : '기본값 사용 ⚠️'}`);

    console.log('\n💡 다음 단계:');
    console.log('   1. 브라우저에서 /dashboard-v2/scrape 접속');
    console.log('   2. "lipstick" 키워드로 스크래핑 시작');
    console.log('   3. /dashboard-v2/products 페이지에서 옵션 확인');
    console.log('   4. Shopify에 업로드하여 최종 확인');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 테스트 중 오류:', error);
    process.exit(1);
  }
}

testVariantsIntegration();
