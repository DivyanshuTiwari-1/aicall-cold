#!/bin/bash

##############################################
# AI Dialer Pro - Database Restore Script
##############################################

BACKUP_DIR="/opt/ai-dialer/backups"
CONTAINER="ai-dialer-postgres"
DB_NAME="ai_dialer_prod"
DB_USER="ai_dialer_user"

echo "Available backups:"
ls -lh $BACKUP_DIR/backup_*.sql.gz

echo ""
read -p "Enter backup filename to restore (e.g., backup_20241023_020000.sql.gz): " BACKUP_FILE

if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    echo "✗ Backup file not found: $BACKUP_DIR/$BACKUP_FILE"
    exit 1
fi

echo ""
echo "WARNING: This will replace the current database with the backup!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "Stopping backend service..."
docker-compose -f docker-compose.production.yml stop backend

echo "Dropping existing database..."
docker exec $CONTAINER psql -U $DB_USER -c "DROP DATABASE IF EXISTS ${DB_NAME}_old;"
docker exec $CONTAINER psql -U $DB_USER -c "ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_old;"

echo "Creating new database..."
docker exec $CONTAINER psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;"

echo "Restoring backup..."
gunzip < $BACKUP_DIR/$BACKUP_FILE | \
  docker exec -i $CONTAINER psql -U $DB_USER $DB_NAME

if [ $? -eq 0 ]; then
    echo "✓ Restore completed successfully!"
    echo "  Old database backed up as: ${DB_NAME}_old"

    read -p "Drop old database? (yes/no): " DROP_OLD
    if [ "$DROP_OLD" = "yes" ]; then
        docker exec $CONTAINER psql -U $DB_USER -c "DROP DATABASE ${DB_NAME}_old;"
        echo "✓ Old database dropped"
    fi
else
    echo "✗ Restore failed!"
    echo "  Attempting to restore original database..."
    docker exec $CONTAINER psql -U $DB_USER -c "DROP DATABASE $DB_NAME;"
    docker exec $CONTAINER psql -U $DB_USER -c "ALTER DATABASE ${DB_NAME}_old RENAME TO $DB_NAME;"
    exit 1
fi

echo ""
echo "Starting backend service..."
docker-compose -f docker-compose.production.yml start backend

echo ""
echo "Restore complete!"
