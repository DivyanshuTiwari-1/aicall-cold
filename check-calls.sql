SELECT id, status, to_number, created_at
FROM calls
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 10;
