#!/bin/bash

##############################################
# AI Dialer Pro - Database Backup Script
##############################################

BACKUP_DIR="/opt/ai-dialer/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="ai-dialer-postgres"
DB_NAME="ai_dialer_prod"
DB_USER="ai_dialer_user"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "Starting backup of $DB_NAME database..."

# Perform backup
docker exec $CONTAINER pg_dump -U $DB_USER $DB_NAME | \
  gzip > $BACKUP_DIR/backup_$DATE.sql.gz

if [ $? -eq 0 ]; then
    echo "✓ Backup completed: backup_$DATE.sql.gz"

    # Get file size
    SIZE=$(du -h $BACKUP_DIR/backup_$DATE.sql.gz | cut -f1)
    echo "  Size: $SIZE"

    # Remove old backups
    DELETED=$(find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
    if [ $DELETED -gt 0 ]; then
        echo "  Deleted $DELETED old backup(s)"
    fi

    # List recent backups
    echo -e "\nRecent backups:"
    ls -lh $BACKUP_DIR/backup_*.sql.gz | tail -5
else
    echo "✗ Backup failed!"
    exit 1
fi
