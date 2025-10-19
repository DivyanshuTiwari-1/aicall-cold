# 🤖 Automated Calls Testing Guide

This comprehensive guide covers how to test the automated calls functionality in your AI Call system.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Testing Methods](#testing-methods)
4. [Manual Testing](#manual-testing)
5. [Automated Testing](#automated-testing)
6. [Integration Testing](#integration-testing)
7. [Performance Testing](#performance-testing)
8. [Troubleshooting](#troubleshooting)

## 🎯 Overview

The automated calls system includes:
- **Queue Management**: Automated call queuing and processing
- **Call Pacing**: Controlled call intervals and concurrent limits
- **Retry Logic**: Automatic retry for failed calls
- **Campaign Management**: Campaign-based call automation
- **Asterisk Integration**: Real telephony integration
- **Performance Monitoring**: Real-time analytics and reporting

## 🔧 Prerequisites

### System Requirements
- Node.js 16+ installed
- PostgreSQL database running
- Asterisk server configured
- Redis (optional, for caching)
- Sufficient credits in organization account

### Environment Setup
```bash
# Set environment variables
export API_BASE_URL=http://localhost:3000
export WS_URL=ws://localhost:3000
export ARI_URL=http://localhost:8088/ari
export ARI_USER=ari_user
export ARI_PASS=ari_password
export MAX_CONCURRENT_CALLS=5
export CALL_INTERVAL_MS=30000
export MAX_RETRY_ATTEMPTS=3
export RETRY_DELAY_MS=300000
```

## 🧪 Testing Methods

### 1. Manual Testing

#### A. Campaign Setup
```bash
# 1. Create a test campaign
curl -X POST http://localhost:3000/api/v1/campaigns \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Automated Campaign",
    "type": "sales",
    "status": "active",
    "settings": {
      "maxConcurrentCalls": 3,
      "callInterval": 30000,
      "retryAttempts": 3,
      "businessHours": {
        "start": "09:00",
        "end": "17:00",
        "timezone": "America/New_York",
        "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
      }
    }
  }'
```

#### B. Add Test Contacts
```bash
# 2. Add contacts to campaign
curl -X POST http://localhost:3000/api/v1/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "CAMPAIGN_ID",
    "contacts": [
      {
        "firstName": "Test",
        "lastName": "Contact1",
        "phone": "+1234567890",
        "email": "test1@example.com",
        "priority": 1
      },
      {
        "firstName": "Test",
        "lastName": "Contact2",
        "phone": "+1234567891",
        "email": "test2@example.com",
        "priority": 2
      }
    ]
  }'
```

#### C. Start Automated Queue
```bash
# 3. Start the automated calling queue
curl -X POST http://localhost:3000/api/v1/queue/start/CAMPAIGN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### D. Monitor Queue Status
```bash
# 4. Check queue status
curl -X GET http://localhost:3000/api/v1/queue/status/CAMPAIGN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### E. Stop Queue
```bash
# 5. Stop the queue
curl -X POST http://localhost:3000/api/v1/queue/stop/CAMPAIGN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Automated Testing

#### Run the Test Suite
```bash
# Navigate to server directory
cd server

# Run the automated calls test suite
node scripts/test-automated-calls.js
```

#### Run Manual Calls Test
```bash
# Run the manual calling flow test
node scripts/test-manual-calling-flow.js
```

#### Run Call Initiation Test
```bash
# Test basic call initiation
node scripts/test-call-initiation.js
```

### 3. Integration Testing

#### A. Database Integration
```sql
-- Check campaign status
SELECT id, name, status, settings FROM campaigns WHERE status = 'active';

-- Check contact queue
SELECT c.first_name, c.last_name, c.phone, c.status, c.retry_count
FROM contacts c
JOIN campaigns camp ON c.campaign_id = camp.id
WHERE camp.id = 'YOUR_CAMPAIGN_ID'
ORDER BY c.priority DESC, c.created_at ASC;

-- Check active calls
SELECT id, contact_id, status, created_at, automated
FROM calls
WHERE status IN ('initiated', 'in_progress')
ORDER BY created_at DESC;
```

#### B. Asterisk Integration
```bash
# Check Asterisk ARI connection
curl -u ari_user:ari_password http://localhost:8088/ari/asterisk/info

# Check active channels
curl -u ari_user:ari_password http://localhost:8088/ari/channels

# Check bridges
curl -u ari_user:ari_password http://localhost:8088/ari/bridges
```

### 4. Performance Testing

#### A. Load Testing
```bash
# Test concurrent call limits
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/v1/queue/start/CAMPAIGN_ID \
    -H "Authorization: Bearer YOUR_TOKEN" &
done
wait
```

#### B. Memory Monitoring
```bash
# Monitor Node.js memory usage
node --inspect server/index.js

# Check with htop or top
htop -p $(pgrep node)
```

#### C. Database Performance
```sql
-- Check slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check active connections
SELECT count(*) FROM pg_stat_activity;
```

## 🔍 Testing Scenarios

### Scenario 1: Basic Automated Calling
1. Create campaign with 5 test contacts
2. Start automated queue
3. Verify calls are initiated at proper intervals
4. Check call status updates
5. Verify call completion logging

### Scenario 2: Call Pacing
1. Set call interval to 10 seconds
2. Set max concurrent calls to 2
3. Add 10 contacts
4. Verify only 2 calls are active at once
5. Verify 10-second intervals between new calls

### Scenario 3: Retry Logic
1. Create contacts with invalid phone numbers
2. Start automated queue
3. Verify failed calls are retried
4. Check retry count increments
5. Verify contacts marked as failed after max retries

### Scenario 4: Business Hours
1. Set business hours to 9 AM - 5 PM
2. Start queue outside business hours
3. Verify calls are not made
4. Start queue during business hours
5. Verify calls are made normally

### Scenario 5: Error Handling
1. Start queue with invalid campaign ID
2. Verify proper error response
3. Test with no contacts in campaign
4. Test with insufficient credits
5. Test with Asterisk connection issues

## 📊 Monitoring and Analytics

### Real-time Monitoring
```bash
# Watch logs in real-time
tail -f logs/application.log | grep -E "(queue|call|asterisk)"

# Monitor WebSocket events
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000');
ws.on('message', data => console.log(JSON.parse(data)));
"
```

### Analytics Queries
```sql
-- Call success rate
SELECT
  COUNT(*) as total_calls,
  COUNT(CASE WHEN outcome IN ('scheduled', 'interested') THEN 1 END) as successful_calls,
  ROUND(COUNT(CASE WHEN outcome IN ('scheduled', 'interested') THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
FROM calls
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Average call duration
SELECT
  AVG(duration) as avg_duration_seconds,
  AVG(duration) / 60 as avg_duration_minutes
FROM calls
WHERE status = 'completed'
AND created_at >= NOW() - INTERVAL '24 hours';

-- Queue performance
SELECT
  campaign_id,
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
FROM contacts c
JOIN campaigns camp ON c.campaign_id = camp.id
WHERE camp.status = 'active'
GROUP BY campaign_id;
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Queue Not Starting
```bash
# Check campaign status
curl -X GET http://localhost:3000/api/v1/campaigns/CAMPAIGN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check for contacts
curl -X GET http://localhost:3000/api/v1/contacts?campaignId=CAMPAIGN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 2. No Calls Being Made
```bash
# Check Asterisk connection
curl -u ari_user:ari_password http://localhost:8088/ari/asterisk/info

# Check queue status
curl -X GET http://localhost:3000/api/v1/queue/status/CAMPAIGN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check logs
tail -f logs/application.log | grep -i error
```

#### 3. Calls Failing
```bash
# Check call events
curl -X GET http://localhost:3000/api/v1/calls/CALL_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check Asterisk channels
curl -u ari_user:ari_password http://localhost:8088/ari/channels
```

#### 4. Performance Issues
```bash
# Check database connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check memory usage
free -h
ps aux | grep node

# Check disk space
df -h
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=ai-call:*
export LOG_LEVEL=debug

# Start server with debug
node --inspect server/index.js
```

## 📈 Success Metrics

### Key Performance Indicators
- **Call Success Rate**: > 15% (industry standard)
- **Queue Processing Time**: < 30 seconds per contact
- **System Uptime**: > 99.5%
- **Error Rate**: < 1%
- **Response Time**: < 2 seconds for API calls

### Monitoring Alerts
- Queue stopped unexpectedly
- Call success rate below 10%
- System memory usage above 80%
- Database connection errors
- Asterisk connection failures

## 🚀 Production Readiness Checklist

- [ ] All automated tests passing
- [ ] Manual testing completed
- [ ] Performance testing completed
- [ ] Error handling tested
- [ ] Monitoring setup
- [ ] Alerts configured
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Rollback plan ready
- [ ] Support procedures documented

## 📞 Support

For additional help with automated calls testing:
- Check the logs in `server/logs/`
- Review the API documentation
- Contact the development team
- Check the troubleshooting section above

---

**Happy Testing! 🎉**

Remember to always test in a staging environment before deploying to production.
