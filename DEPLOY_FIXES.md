# Deploy AI Call System Fixes

## Quick Deploy (Recommended)

All fixes have been committed. To deploy to production:

```bash
# Commit and push
git add -A
git commit -m "Fix: AI automated calling bugs - queue, events, validation"
git push origin main
```

GitHub Actions will automatically deploy to https://atsservices.site/

---

## What the Deployment Will Do

1. **Pull latest code** from GitHub
2. **Stop all containers** (including duplicates)
3. **Rebuild with `--no-cache`** (ensures fresh build)
4. **Run migrations** automatically:
   - `add-phone-number-fields` migration will add `from_number` and `to_number` columns
5. **Start services** with fixed code
6. **Verify health** checks pass

---

## Post-Deployment Verification

### 1. Check Migration Ran Successfully

```bash
# SSH to server
ssh ubuntu@13.53.89.241

# Check logs
docker logs ai-dialer-backend --tail 100 | grep "add-phone-number-fields"

# Should see:
# ✅ Migration completed: add-phone-number-fields
```

### 2. Verify Database Schema

```bash
# SSH to server
ssh ubuntu@13.53.89.241

# Connect to database
docker exec -it ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod

# Check columns exist
\d calls

# Should show:
# from_number | character varying(20)
# to_number   | character varying(20)

# Exit
\q
```

### 3. Test Automated Calling

1. **Login to dashboard**: https://atsservices.site/
2. **Go to Campaigns** page
3. **Create or select a campaign** with contacts
4. **Click "Start Automated Calls"**
5. **Select a phone number**
6. **Click Start**
7. **Verify**:
   - Queue starts successfully
   - No validation errors
   - Calls begin initiating

### 4. Test Stopping Queue

1. **Click "Stop" button** on active campaign
2. **Verify**:
   - Queue stops successfully
   - No errors in console
   - Status updates to "Stopped"

### 5. Check Call History

1. **Go to Calls** page
2. **Look for recent automated calls**
3. **Verify**:
   - Calls appear in history
   - Transcripts show customer and AI conversation
   - Outcomes are recorded correctly

---

## If Something Goes Wrong

### Rollback Steps

```bash
# SSH to server
ssh ubuntu@13.53.89.241
cd /opt/ai-dialer

# Check previous commit
git log --oneline -5

# Rollback to previous commit
git reset --hard <previous-commit-hash>

# Rebuild
docker-compose -f docker-compose.demo.yml up -d --build --force-recreate
```

### Check Logs

```bash
# Backend logs
docker logs ai-dialer-backend --tail 100 -f

# All services
docker-compose -f docker-compose.demo.yml logs --tail 50 -f
```

### Database Issues

If migration fails:

```bash
# Connect to database
docker exec -it ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod

# Manually add columns
ALTER TABLE calls ADD COLUMN IF NOT EXISTS from_number VARCHAR(20);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS to_number VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_calls_from_number ON calls(from_number);
CREATE INDEX IF NOT EXISTS idx_calls_to_number ON calls(to_number);
```

---

## Manual Deployment (If GitHub Actions Fails)

```bash
# SSH to server
ssh ubuntu@13.53.89.241
cd /opt/ai-dialer

# Pull latest
git pull origin main

# Stop all containers
docker stop $(docker ps --filter "name=ai-dialer" -q)
docker rm $(docker ps -a --filter "name=ai-dialer" -q)

# Clean up
docker-compose -f docker-compose.demo.yml down

# Rebuild
docker-compose -f docker-compose.demo.yml build --no-cache --pull

# Start
docker-compose -f docker-compose.demo.yml up -d --force-recreate

# Wait for services
sleep 30

# Check status
docker-compose -f docker-compose.demo.yml ps

# Check logs
docker logs ai-dialer-backend --tail 50
```

---

## Testing Script

Create a test to verify all fixes:

```bash
# On your local machine or server

# 1. Test TTS endpoint
curl -X POST http://localhost:3000/api/v1/asterisk/tts/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test", "voice": "amy"}'

# Should return: {"success":true,"audio_url":"...","cached":false}

# 2. Check database columns
docker exec ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod -c "\d calls" | grep "number"

# Should show: from_number and to_number columns

# 3. Check conversation events
docker exec ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod -c "SELECT DISTINCT event_type FROM call_events"

# Should include: ai_conversation
```

---

## Expected Results After Deployment

✅ **No errors** in backend logs
✅ **Migrations run successfully**
✅ **All services healthy**
✅ **Can start automated calling queue**
✅ **Can stop automated calling queue**
✅ **Calls appear in history with transcripts**
✅ **TTS/STT endpoints responding**

---

## Support

If issues persist:

1. Check `BUGS_FIXED_SUMMARY.md` for details of what was fixed
2. Review logs: `docker logs ai-dialer-backend --tail 200`
3. Verify all changes were deployed: `git log --oneline -10`
4. Check database schema matches expected structure

---

**All fixes are ready to deploy!** 🚀
