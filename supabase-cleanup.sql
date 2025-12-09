-- Supabase에서 실행할 SQL: 현재 데이터 확인 및 정리

-- 1. 현재 저장된 데이터 확인
SELECT 
  asin,
  title,
  amazon_price,
  margin_rate,
  selling_price,
  created_at
FROM products
ORDER BY created_at DESC;

-- 2. 비정상적인 가격 데이터 확인 (100만원 이상)
SELECT 
  asin,
  title,
  amazon_price,
  selling_price
FROM products
WHERE amazon_price > 10000 OR selling_price > 10000;

-- 3. 모든 상품 삭제 (새로 수집하기 위해)
-- 주의: 실행 전 확인 필요!
DELETE FROM products;

-- 4. 삭제 후 확인
SELECT COUNT(*) as total_products FROM products;
