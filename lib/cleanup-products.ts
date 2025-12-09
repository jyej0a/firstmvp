/**
 * @file lib/cleanup-products.ts
 * @description 브라우저 콘솔에서 실행할 DB 정리 함수
 * 
 * 브라우저 개발자 도구 콘솔에서 다음을 실행:
 * 
 * // 1. 모든 상품 삭제
 * fetch('/api/products/cleanup', { method: 'DELETE' })
 *   .then(r => r.json())
 *   .then(console.log);
 * 
 * // 2. 상품 개수 확인
 * fetch('/api/products')
 *   .then(r => r.json())
 *   .then(d => console.log('총', d.data.total, '개'));
 */

// 이 파일은 참고용입니다. 실제로는 Supabase Dashboard를 사용하세요.

export async function cleanupProducts() {
  const response = await fetch('/api/products/cleanup', {
    method: 'DELETE'
  });
  return response.json();
}

export async function countProducts() {
  const response = await fetch('/api/products');
  const data = await response.json();
  return data.data?.total || 0;
}
