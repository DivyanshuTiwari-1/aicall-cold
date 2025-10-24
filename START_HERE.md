# 🚀 START HERE - Production Deployment

## Your Complete Workflow in 3 Steps

### 1️⃣ Configure Domain (Do Once)

Open `deploy.sh` and change line 12:

```bash
DOMAIN="yourdomain.com"  # ⬅️ Change this!
```

Save, commit, and push:

```bash
git add deploy.sh
git commit -m "Set production domain"
git push origin main
```

---

### 2️⃣ Setup DNS (Give to DNS Admin)

**Your AWS Server IP:**
```bash
# On AWS server, run:
curl ifconfig.me
```

**DNS Records needed:**
```
Type    Name    Value                TTL
A       @       YOUR_AWS_SERVER_IP   3600
A       www     YOUR_AWS_SERVER_IP   3600
A       api     YOUR_AWS_SERVER_IP   3600
```

**Wait 15-30 minutes for DNS propagation**

---

### 3️⃣ Deploy on AWS Server

```bash
# SSH to your AWS server
ssh ubuntu@your-aws-ip

# Clone repository (first time only)
git clone <your-github-repo-url> /opt/ai-dialer
cd /opt/ai-dialer

# Deploy!
chmod +x deploy.sh
./deploy.sh
```

**Done!** 🎉

- Frontend: `https://yourdomain.com`
- Login: `admin@yourdomain.com` / `Admin123!`

---

## 🔄 Daily Workflow (After First Deployment)

When you make changes to code:

```bash
# 1. Commit and push
git add .
git commit -m "Your changes"
git push origin main

# 2. Update production
ssh ubuntu@your-aws-ip
cd /opt/ai-dialer
git pull origin main
./deploy.sh
```

**That's it!** Your changes are live. ✅

---

## 🛡️ What's Automatically Protected

- ✅ All database data (users, campaigns, contacts, calls)
- ✅ User uploads
- ✅ Application logs
- ✅ SSL certificates
- ✅ Redis cache

**You can run `./deploy.sh` as many times as you want - data never gets lost!**

---

## 🔧 What `deploy.sh` Does Automatically

1. Creates database backup (if exists)
2. Generates secure passwords (first time only)
3. Creates all config files with your domain
4. Sets up SSL certificate (Let's Encrypt)
5. Cleans old containers/images (frees disk space!)
6. Builds and deploys all services
7. Runs database migrations
8. Creates admin user (first time only)
9. Configures firewall
10. Verifies everything is working

---

## 📊 Check Status

```bash
# View all services
docker-compose -f docker-compose.demo.yml ps

# View logs
docker-compose -f docker-compose.demo.yml logs -f

# Check backend health
curl http://localhost:3000/health

# Restart if needed
docker-compose -f docker-compose.demo.yml restart
```

---

## ⚠️ AWS Security Group

Make sure these ports are open in AWS Security Group:

```
22          SSH
80          HTTP
443         HTTPS
3000        Backend
3001        Frontend
5060/UDP    SIP
8088        Asterisk
10000-10100/UDP  RTP
```

---

## 🚨 If Something Goes Wrong

```bash
# View logs to see what failed
docker-compose -f docker-compose.demo.yml logs -f

# Restart all services
docker-compose -f docker-compose.demo.yml restart

# Restore from backup (if needed)
ls backups/
gunzip < backups/backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i ai-dialer-postgres psql -U ai_dialer_user ai_dialer_prod
```

---

## 📚 More Information

- **Quick Guide**: `DEPLOYMENT_README.md`
- **Full Documentation**: `PRODUCTION_DEPLOYMENT.md`

---

## ✅ Summary

**You only need to:**
1. Change domain in `deploy.sh` (once)
2. Configure DNS records (once)
3. Run `./deploy.sh` (first time and every update)

**Everything else is automatic!** 🎉

No data loss, no manual configuration, no complexity!
