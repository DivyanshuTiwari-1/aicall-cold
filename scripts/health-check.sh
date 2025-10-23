#!/bin/bash

##############################################
# AI Dialer Pro - Health Check Script
# Run this via cron every 5 minutes
##############################################

LOG_FILE="/var/log/ai-dialer-health.log"
ALERT_EMAIL="admin@yourdomain.com"  # Change this!

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

send_alert() {
    local SUBJECT="$1"
    local MESSAGE="$2"

    # Send email alert (requires mailutils or sendmail)
    # echo "$MESSAGE" | mail -s "$SUBJECT" $ALERT_EMAIL

    # Or use webhook/Slack/Discord
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"$SUBJECT: $MESSAGE\"}" \
    #   YOUR_WEBHOOK_URL

    log "ALERT: $SUBJECT - $MESSAGE"
}

# Check backend health
if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
    log "Backend unhealthy - attempting restart"
    docker restart ai-dialer-backend

    # Wait and recheck
    sleep 10
    if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
        send_alert "Backend Down" "Backend service failed to restart"
    else
        log "Backend restarted successfully"
    fi
fi

# Check database
if ! docker exec ai-dialer-postgres pg_isready -U ai_dialer_user > /dev/null 2>&1; then
    send_alert "Database Down" "PostgreSQL is not responding"
fi

# Check Redis
if ! docker exec ai-dialer-redis redis-cli ping > /dev/null 2>&1; then
    send_alert "Redis Down" "Redis is not responding"
fi

# Check Asterisk
if ! docker exec ai-dialer-asterisk asterisk -rx "core show version" > /dev/null 2>&1; then
    send_alert "Asterisk Down" "Asterisk is not responding"
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    send_alert "Disk Space Critical" "Disk usage at ${DISK_USAGE}%"
fi

# Check memory
MEM_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
if [ $MEM_USAGE -gt 90 ]; then
    send_alert "Memory Critical" "Memory usage at ${MEM_USAGE}%"
fi

# Check container status
STOPPED_CONTAINERS=$(docker-compose -f /opt/ai-dialer/docker-compose.production.yml ps | grep "Exit" | wc -l)
if [ $STOPPED_CONTAINERS -gt 0 ]; then
    send_alert "Containers Stopped" "$STOPPED_CONTAINERS container(s) are not running"
fi

log "Health check completed"
