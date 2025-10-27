#!/bin/bash
#################################################
# Production Server Disk Cleanup Script
# Run this on your production server to free up space
#################################################

set -e

echo "========================================"
echo "🧹 Disk Space Cleanup - Production"
echo "========================================"
echo ""

# Check initial disk usage
echo "📊 Current Disk Usage:"
df -h /
echo ""

# Clean up Docker
echo "🐳 Cleaning up Docker resources..."
echo ""

# Remove unused containers
echo "   Removing stopped containers..."
docker container prune -f

# Remove unused images (keep currently used images)
echo "   Removing dangling images..."
docker image prune -f

# Remove unused networks
echo "   Removing unused networks..."
docker network prune -f

# Remove unused volumes (BE CAREFUL - this can delete data!)
echo "   Checking unused volumes..."
UNUSED_VOLUMES=$(docker volume ls -qf dangling=true | wc -l)
if [ "$UNUSED_VOLUMES" -gt 0 ]; then
    echo "   ⚠️  Found $UNUSED_VOLUMES unused volumes"
    echo "   ⚠️  Skipping volume cleanup for safety (run manually if needed: docker volume prune -f)"
else
    echo "   ✅ No unused volumes found"
fi

# Advanced cleanup - removes all unused data (images not used by any container)
echo ""
read -p "🔥 Run aggressive cleanup? This removes ALL unused Docker data. (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Running aggressive cleanup..."
    docker system prune -af --volumes
else
    echo "   Skipped aggressive cleanup"
fi

echo ""

# Clean up old log files
echo "📝 Cleaning up old log files..."
echo ""

# Clean logs older than 7 days
if [ -d "/opt/ai-dialer/logs" ]; then
    echo "   Cleaning application logs..."
    find /opt/ai-dialer/logs -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
    echo "   ✅ Old log files cleaned"
fi

# Clean Docker logs
echo "   Truncating large Docker container logs..."
truncate -s 0 /var/lib/docker/containers/*/*-json.log 2>/dev/null || echo "   ⚠️  Could not truncate Docker logs (may need sudo)"

# Clean apt cache
echo ""
echo "📦 Cleaning APT cache..."
sudo apt-get clean || echo "   ⚠️  Could not clean apt cache"
sudo apt-get autoremove -y || echo "   ⚠️  Could not autoremove packages"

# Clean journal logs
echo ""
echo "📰 Cleaning system journal logs (keeping last 3 days)..."
sudo journalctl --vacuum-time=3d || echo "   ⚠️  Could not clean journal logs"

# Clean npm cache
echo ""
echo "📦 Cleaning npm cache..."
if [ -d "/opt/ai-dialer/server" ]; then
    cd /opt/ai-dialer/server
    npm cache clean --force 2>/dev/null || echo "   ⚠️  Could not clean npm cache"
fi
if [ -d "/opt/ai-dialer/client" ]; then
    cd /opt/ai-dialer/client
    npm cache clean --force 2>/dev/null || echo "   ⚠️  Could not clean npm cache"
fi

# Check final disk usage
echo ""
echo "========================================"
echo "✅ Cleanup Complete!"
echo "========================================"
echo ""

echo "📊 Disk Usage After Cleanup:"
df -h /
echo ""

echo "🐳 Docker Disk Usage:"
docker system df
echo ""

# Show space freed
SPACE_BEFORE=$(df / | tail -1 | awk '{print $4}')
echo "💾 Disk space available: $(df -h / | tail -1 | awk '{print $4}')"
echo ""

echo "✨ Cleanup complete! If disk space is still low, consider:"
echo "   1. Removing old application backups"
echo "   2. Running: docker system prune -af --volumes (removes ALL unused data)"
echo "   3. Expanding disk size on your cloud provider"
echo ""
