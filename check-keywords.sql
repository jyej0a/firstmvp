-- 금지어 총 개수 확인
SELECT COUNT(*) as total_keywords FROM banned_keywords;

-- 최근 추가된 금지어 20개 확인
SELECT keyword, created_at 
FROM banned_keywords 
ORDER BY created_at DESC 
LIMIT 20;

