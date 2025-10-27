-- Check recent calls
SELECT
    c.id,
    c.status,
    c.automated,
    c.created_at,
    c.duration,
    ct.first_name,
    ct.last_name,
    ct.phone
FROM calls c
JOIN contacts ct ON c.contact_id = ct.id
WHERE c.created_at > NOW() - INTERVAL '24 hours'
ORDER BY c.created_at DESC
LIMIT 20;

-- Check conversation data
SELECT
    ce.call_id,
    ce.event_type,
    ce.event_data,
    ce.created_at
FROM call_events ce
WHERE ce.created_at > NOW() - INTERVAL '24 hours'
ORDER BY ce.created_at DESC
LIMIT 20;
