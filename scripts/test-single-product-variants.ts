/**
 * 실제 scrapeSingleProduct 함수 테스트
 * 
 * 수정된 amazon-scraper.ts의 scrapeSingleProduct를 호출하여
 * variants가 정상적으로 수집되는지 확인합니다.
 */

import { scrapeSingleProduct } from '../lib/scraper/amazon-scraper';

// FREEORR 립스틱 직접 URL (명확한 variants 있는 상품)
const DIRECT_URL = 'https://www.amazon.com/FREEORR-Lipstick-Hydrating-Lightweight-Finish-Set/dp/B0G6419DPJ';

async function testSingleProductVariants() {
  console.log('🧪 실제 scrapeSingleProduct 함수 테스트\n');
  console.log('📍 직접 상품 URL:', DIRECT_URL);
  console.log('📍 이 상품은 "Color: Set A / Set B" 옵션이 있음\n');

  try {
    console.log('🔍 상품 수집 시작...\n');
    
    // 직접 URL 사용 (offset 0)
    const product = await scrapeSingleProduct(DIRECT_URL, 0, {
      headless: false,
      verbose: true,
      timeout: 90000,
    });

    if (!product) {
      console.error('❌ 상품 수집 실패');
      process.exit(1);
    }

    console.log('\n✅ 상품 수집 성공!\n');
    console.log('='.repeat(60));
    console.log('📦 수집된 상품 정보:');
    console.log('='.repeat(60));
    console.log(`ASIN: ${product.asin}`);
    console.log(`제목: ${product.title?.substring(0, 60)}...`);
    console.log(`가격: $${product.price}`);
    console.log(`원본 URL: ${product.sourceUrl}`);
    console.log(`\n🎨 Variants:`);
    
    if (product.variants && product.variants.length > 0) {
      console.log('✅ Variants 수집 성공!');
      product.variants.forEach((variant, idx) => {
        console.log(`  [${idx}] ${variant}`);
      });
    } else {
      console.log('❌ Variants 없음 또는 수집 실패');
      console.log('   (이 상품에 옵션이 없을 수도 있습니다)');
    }

    console.log(`\n📊 기타 정보:`);
    console.log(`  - 카테고리: ${product.category || 'N/A'}`);
    console.log(`  - 브랜드: ${product.brand || 'N/A'}`);
    console.log(`  - 무게: ${product.weight ? `${product.weight} kg` : 'N/A'}`);
    console.log(`  - 리뷰수: ${product.review_count || 0}`);
    console.log(`  - 평점: ${product.rating || 'N/A'}`);
    console.log(`  - 이미지: ${product.images?.length || 0}개`);
    
    console.log('\n' + '='.repeat(60));

    // 성공 종료
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 테스트 중 오류 발생:', error);
    process.exit(1);
  }
}

testSingleProductVariants();

