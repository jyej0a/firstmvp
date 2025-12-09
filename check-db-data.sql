-- 저장된 상품 데이터 확인
SELECT 
  asin,
  title,
  amazon_price,
  margin_rate,
  selling_price,
  created_at
FROM products
ORDER BY created_at DESC
LIMIT 3;
