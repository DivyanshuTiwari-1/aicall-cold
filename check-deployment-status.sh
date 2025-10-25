#!/bin/bash

#################################################
# Deployment Status Check Script
# Diagnoses what's running and identifies issues
#################################################

echo "=========================================="
echo "🔍 AI Dialer - Deployment Status Check"
echo "=========================================="
echo ""

# Color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Docker
echo "🐳 Docker Status:"
if command -v docker &> /dev/null; then
    echo -e "   ${GREEN}✓${NC} Docker is installed"
    docker --version
else
    echo -e "   ${RED}✗${NC} Docker is not installed"
    exit 1
fi
echo ""

# Check all ai-dialer containers
echo "📦 Container Status:"
CONTAINERS=$(docker ps -a --filter "name=ai-dialer" --format "{{.Names}}")
if [ -z "$CONTAINERS" ]; then
    echo -e "   ${YELLOW}⚠${NC} No ai-dialer containers found"
else
    echo "   Found containers:"
    docker ps -a --filter "name=ai-dialer" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | sed 's/^/   /'
fi
echo ""

# Check for duplicate containers
echo "🔍 Duplicate Detection:"
DUPLICATES=$(docker ps -a --filter "name=ai-dialer" --format "{{.Names}}" | sort | uniq -d)
if [ -z "$DUPLICATES" ]; then
    echo -e "   ${GREEN}✓${NC} No duplicate containers detected"
else
    echo -e "   ${RED}✗${NC} Duplicate containers found:"
    echo "$DUPLICATES" | sed 's/^/   /'
    echo ""
    echo "   ${YELLOW}ACTION NEEDED:${NC} Run ./cleanup-all-containers.sh to remove duplicates"
fi
echo ""

# Check which docker-compose files exist
echo "📄 Available Docker Compose Files:"
for file in docker-compose.yml docker-compose.demo.yml docker-compose.simplified.yml docker-compose.services.yml; do
    if [ -f "$file" ]; then
        echo -e "   ${GREEN}✓${NC} $file"
    else
        echo -e "   ${RED}✗${NC} $file (not found)"
    fi
done
echo ""

# Check running containers by compose file
echo "🔄 Active Compose Deployments:"
for file in docker-compose.demo.yml docker-compose.simplified.yml docker-compose.yml; do
    if [ -f "$file" ]; then
        RUNNING=$(docker-compose -f "$file" ps -q 2>/dev/null | wc -l)
        if [ "$RUNNING" -gt 0 ]; then
            echo -e "   ${GREEN}✓${NC} $file - $RUNNING containers running"
            echo "      Containers:"
            docker-compose -f "$file" ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | tail -n +2 | sed 's/^/      /'
        else
            echo "   ○ $file - No containers running"
        fi
    fi
done
echo ""

# Check ports in use
echo "🔌 Port Usage:"
for port in 80 443 3000 3001 5432 6379 8088 5060; do
    PROCESS=$(lsof -i :$port 2>/dev/null | tail -n +2)
    if [ ! -z "$PROCESS" ]; then
        echo -e "   ${YELLOW}⚠${NC} Port $port is in use:"
        echo "$PROCESS" | sed 's/^/      /'
    else
        echo -e "   ${GREEN}✓${NC} Port $port is free"
    fi
done
echo ""

# Check if services are responding
echo "🌐 Service Health:"

# Backend
if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓${NC} Backend (port 3000) - HEALTHY"
else
    echo -e "   ${RED}✗${NC} Backend (port 3000) - NOT RESPONDING"
fi

# Frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null)
if [ "$FRONTEND_STATUS" = "200" ] || [ "$FRONTEND_STATUS" = "304" ]; then
    echo -e "   ${GREEN}✓${NC} Frontend (port 3001) - HEALTHY"
else
    echo -e "   ${RED}✗${NC} Frontend (port 3001) - NOT RESPONDING (Status: $FRONTEND_STATUS)"
fi

# Database
DB_STATUS=$(docker exec ai-dialer-postgres pg_isready 2>/dev/null)
if [[ "$DB_STATUS" == *"accepting connections"* ]]; then
    echo -e "   ${GREEN}✓${NC} PostgreSQL - HEALTHY"
else
    echo -e "   ${RED}✗${NC} PostgreSQL - NOT RESPONDING"
fi

# Redis
REDIS_STATUS=$(docker exec ai-dialer-redis redis-cli ping 2>/dev/null)
if [ "$REDIS_STATUS" = "PONG" ]; then
    echo -e "   ${GREEN}✓${NC} Redis - HEALTHY"
else
    echo -e "   ${RED}✗${NC} Redis - NOT RESPONDING"
fi
echo ""

# Check data volumes
echo "💾 Data Volumes:"
docker volume ls --filter "name=ai-dialer" --format "table {{.Name}}\t{{.Size}}" 2>/dev/null || \
docker volume ls --filter "name=postgres" --format "table {{.Name}}\t{{.Size}}" 2>/dev/null
echo ""

# Check environment file
echo "⚙️  Environment Configuration:"
if [ -f ".env.production" ]; then
    echo -e "   ${GREEN}✓${NC} .env.production exists"
    SIZE=$(wc -c < .env.production)
    echo "      Size: $SIZE bytes"
else
    echo -e "   ${RED}✗${NC} .env.production not found"
fi
echo ""

# Check Git status
echo "📋 Git Status:"
if [ -d .git ]; then
    echo "   Current branch: $(git branch --show-current)"
    echo "   Latest commit:"
    git log --oneline -1 | sed 's/^/   /'

    # Check if there are uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "   ${YELLOW}⚠${NC} Uncommitted changes detected"
    else
        echo -e "   ${GREEN}✓${NC} Working directory clean"
    fi
else
    echo -e "   ${YELLOW}⚠${NC} Not a Git repository"
fi
echo ""

# Recommendations
echo "=========================================="
echo "📋 RECOMMENDATIONS:"
echo "=========================================="
echo ""

CONTAINER_COUNT=$(docker ps --filter "name=ai-dialer" -q | wc -l)
if [ "$CONTAINER_COUNT" -eq 0 ]; then
    echo "❌ No containers running"
    echo "   → Run: ./update-production-auto.sh"
elif [ "$CONTAINER_COUNT" -gt 6 ]; then
    echo "⚠️  Too many containers running ($CONTAINER_COUNT)"
    echo "   → Possible duplicates detected"
    echo "   → Run: ./cleanup-all-containers.sh"
    echo "   → Then: ./update-production-auto.sh"
else
    BACKEND_HEALTHY=$(curl -f -s http://localhost:3000/health > /dev/null 2>&1 && echo "yes" || echo "no")
    FRONTEND_HEALTHY=$(curl -f -s http://localhost:3001 > /dev/null 2>&1 && echo "yes" || echo "no")

    if [ "$BACKEND_HEALTHY" = "yes" ] && [ "$FRONTEND_HEALTHY" = "yes" ]; then
        echo "✅ System appears healthy!"
        echo "   → Your deployment is working correctly"
        echo "   → Changes from GitHub should propagate normally"
    else
        echo "⚠️  Some services are not responding"
        echo "   → Check logs: docker-compose -f docker-compose.demo.yml logs"
        echo "   → Try restart: docker-compose -f docker-compose.demo.yml restart"
    fi
fi

echo ""
echo "🔗 Useful commands:"
echo "   • View logs:     docker-compose -f docker-compose.demo.yml logs -f"
echo "   • Stop all:      ./cleanup-all-containers.sh"
echo "   • Fresh deploy:  ./update-production-auto.sh"
echo "   • Check status:  ./check-deployment-status.sh"
echo ""
echo "=========================================="
