# 🧹 Server Cleanup Commands

## Quick Cleanup Script

```bash
# Run the interactive cleanup script
chmod +x cleanup-server.sh
./cleanup-server.sh
```

---

## Manual Cleanup Commands

### Option 1: Stop Everything (Safe - No Data Loss)

```bash
# Stop all AI Dialer services
docker-compose -f docker-compose.demo.yml stop

# Or stop all Docker containers
docker stop $(docker ps -aq)
```

**What this does:** Stops containers but keeps everything for restart
**Data preserved:** ✅ Everything

---

### Option 2: Remove Containers Only

```bash
# Stop and remove AI Dialer containers (keeps volumes/data)
docker-compose -f docker-compose.demo.yml down

# Remove all stopped containers
docker container prune -f

# Or force remove all containers
docker rm -f $(docker ps -aq)
```

**What this does:** Removes containers, keeps images and data
**Data preserved:** ✅ All data volumes, ✅ Images

---

### Option 3: Remove Containers + Images (Keep Data)

```bash
# Stop and remove containers
docker-compose -f docker-compose.demo.yml down

# Remove all containers
docker rm -f $(docker ps -aq)

# Remove all images
docker rmi -f $(docker images -aq)

# Clean up dangling resources
docker system prune -f
```

**What this does:** Removes containers and images, keeps data
**Data preserved:** ✅ All data volumes (database, uploads, logs)

---

### Option 4: FULL CLEANUP (⚠️ Deletes Everything Including Data!)

```bash
# Stop and remove EVERYTHING including volumes
docker-compose -f docker-compose.demo.yml down -v

# Remove all containers
docker rm -f $(docker ps -aq)

# Remove all images
docker rmi -f $(docker images -aq)

# Remove all volumes (⚠️ THIS DELETES DATA!)
docker volume rm $(docker volume ls -q)

# Remove all networks
docker network prune -f

# Final cleanup
docker system prune -a -f --volumes
```

**⚠️ WARNING:** This deletes ALL data including database!
**Data preserved:** ❌ Nothing - complete wipe

---

### Option 5: Nuclear Cleanup (☢️ Everything)

```bash
# Stop everything
docker stop $(docker ps -aq)

# Nuclear option - removes EVERYTHING
docker system prune -a -f --volumes

# Extra cleanup
docker container prune -f
docker image prune -a -f
docker volume prune -f
docker network prune -f
```

**☢️ WARNING:** Removes everything Docker-related
**Data preserved:** ❌ Nothing

---

## Specific Cleanup Commands

### Remove AI Dialer Services Only

```bash
# Stop and remove services (preserves data)
docker-compose -f docker-compose.demo.yml down

# Stop and remove services (deletes data!)
docker-compose -f docker-compose.demo.yml down -v
```

### Remove Specific Container

```bash
# Stop specific container
docker stop ai-dialer-backend

# Remove specific container
docker rm ai-dialer-backend

# Force remove (even if running)
docker rm -f ai-dialer-backend
```

### Remove Specific Volume

```bash
# List volumes
docker volume ls

# Remove specific volume (⚠️ deletes data!)
docker volume rm postgres_data

# Remove all unused volumes
docker volume prune -f
```

### Clean Docker Build Cache

```bash
# Remove build cache
docker builder prune -f

# Remove all build cache
docker builder prune -a -f
```

### Free Up Disk Space

```bash
# Show disk usage
docker system df

# Clean up unused resources
docker system prune -f

# Aggressive cleanup (removes unused images)
docker system prune -a -f

# Nuclear cleanup (removes everything)
docker system prune -a -f --volumes
```

---

## Check What's Running

### View Current Status

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# List images
docker images

# List volumes
docker volume ls

# Show disk usage
docker system df
```

### View Logs Before Cleanup

```bash
# View all logs
docker-compose -f docker-compose.demo.yml logs

# View specific service
docker logs ai-dialer-backend
docker logs ai-dialer-frontend
docker logs ai-dialer-postgres
```

---

## Cleanup By Category

### Containers

```bash
# Stop all containers
docker stop $(docker ps -aq)

# Remove all containers
docker rm $(docker ps -aq)

# Remove all stopped containers
docker container prune -f

# Force remove all containers
docker rm -f $(docker ps -aq)
```

### Images

```bash
# Remove unused images
docker image prune -f

# Remove all images
docker image prune -a -f

# Force remove all images
docker rmi -f $(docker images -aq)

# Remove specific image
docker rmi ai-dialer-backend:latest
```

### Volumes

```bash
# Remove unused volumes
docker volume prune -f

# Remove all volumes (⚠️ deletes data!)
docker volume rm $(docker volume ls -q)

# Remove specific volume
docker volume rm postgres_data
docker volume rm redis_data
```

### Networks

```bash
# Remove unused networks
docker network prune -f

# List networks
docker network ls

# Remove specific network
docker network rm ai-dialer-network
```

---

## Safe Cleanup Routine (Recommended)

This preserves your data while freeing space:

```bash
# 1. Stop services
docker-compose -f docker-compose.demo.yml down

# 2. Remove old/unused images
docker image prune -a -f

# 3. Remove unused containers
docker container prune -f

# 4. Clean build cache
docker builder prune -f

# 5. Remove unused networks
docker network prune -f

# 6. Check disk usage
docker system df
```

**Data preserved:** ✅ All volumes (database, uploads, logs)

---

## Complete Fresh Start

If you want to start completely fresh:

```bash
# 1. Backup data first (important!)
docker exec ai-dialer-postgres pg_dump -U ai_dialer_user ai_dialer_prod | \
  gzip > backup_before_cleanup_$(date +%Y%m%d).sql.gz

# 2. Stop and remove everything
docker-compose -f docker-compose.demo.yml down -v

# 3. Remove all containers
docker rm -f $(docker ps -aq)

# 4. Remove all images
docker rmi -f $(docker images -aq)

# 5. Remove all volumes
docker volume rm $(docker volume ls -q)

# 6. System cleanup
docker system prune -a -f --volumes

# 7. Verify everything is clean
docker ps -a
docker images
docker volume ls

# 8. Deploy fresh
./deploy.sh
```

---

## Uninstall Docker Completely (If Needed)

```bash
# Stop Docker service
sudo systemctl stop docker

# Remove Docker packages
sudo apt-get purge docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Remove Docker data
sudo rm -rf /var/lib/docker
sudo rm -rf /var/lib/containerd

# Remove Docker group
sudo groupdel docker

# Remove Docker service files
sudo rm /etc/systemd/system/docker.service
sudo rm /etc/systemd/system/docker.socket

# Reload systemd
sudo systemctl daemon-reload
```

---

## Quick Reference

| Command | What It Does | Data Safe? |
|---------|-------------|------------|
| `docker-compose down` | Stop & remove containers | ✅ Yes |
| `docker-compose down -v` | Stop & remove with volumes | ❌ No |
| `docker stop $(docker ps -aq)` | Stop all containers | ✅ Yes |
| `docker rm -f $(docker ps -aq)` | Remove all containers | ✅ Yes (if volumes not removed) |
| `docker rmi -f $(docker images -aq)` | Remove all images | ✅ Yes |
| `docker volume prune -f` | Remove unused volumes | ⚠️ Only unused |
| `docker system prune -a -f` | Clean everything except volumes | ✅ Yes |
| `docker system prune -a -f --volumes` | Clean EVERYTHING | ❌ No |

---

## Before Production Cleanup

**Always backup first:**

```bash
# Create backup
docker exec ai-dialer-postgres pg_dump -U ai_dialer_user ai_dialer_prod | \
  gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Copy uploads
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz server/uploads/

# List backups
ls -lh backup*.sql.gz uploads_backup*.tar.gz
```

---

## After Cleanup

```bash
# Verify everything is cleaned
docker ps -a              # Should show no containers
docker images            # Should show no/few images
docker volume ls         # Should show no/few volumes
docker system df         # Should show low usage

# Deploy fresh
./deploy.sh
```

---

## Need Help?

- For safe cleanup: Use Option 1 or 2
- To free space: Use Option 3
- For fresh start: Use Option 4 (backup first!)
- If unsure: Run `./cleanup-server.sh` interactive script
