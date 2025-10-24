# 🚀 AI Dialer - Simple Production Deployment

## One Script Does Everything! 🎯

Just **change your domain** in `deploy.sh` and run it. That's it!

---

## 📋 Complete Deployment in 3 Steps

### Step 1: Configure Your Domain (Local)

Edit `deploy.sh` line 12:

```bash
DOMAIN="yourdomain.com"  # ⚠️ Change this to your actual domain
```

Push to GitHub:

```bash
git add deploy.sh
git commit -m "Configure production domain"
git push origin main
```

### Step 2: Configure DNS

Add these DNS A records pointing to your AWS server IP:

```
Type    Name    Value              TTL
A       @       YOUR_AWS_IP        3600
A       www     YOUR_AWS_IP        3600
A       api     YOUR_AWS_IP        3600
```

Get your AWS IP: `curl ifconfig.me` (run on AWS server)

### Step 3: Deploy on AWS Server

```bash
# SSH to server
ssh ubuntu@your-aws-ip

# Clone repository
git clone <your-repo-url> /opt/ai-dialer
cd /opt/ai-dialer

# Run deployment
chmod +x deploy.sh
./deploy.sh
```

**Done!** 🎉 Access your app at: `https://yourdomain.com`

---

## 🔄 Updating After Changes

Every time you make changes:

```bash
# 1. Push changes
git push origin main

# 2. On server
ssh ubuntu@your-aws-ip
cd /opt/ai-dialer
git pull origin main
./deploy.sh
```

**Data is automatically preserved!** ✅

---

## 🛡️ What's Protected (Never Lost)

- ✅ Database data (all users, campaigns, contacts, calls)
- ✅ User uploads
- ✅ Application logs
- ✅ SSL certificates
- ✅ Redis cache

The script automatically:
- Creates backups before updates
- Cleans old containers/images (frees space!)
- Preserves all data volumes
- Generates SSL certificates
- Sets up firewall rules

---

## 📊 What the Script Does

1. **Detects** if this is first run or update
2. **Backs up** existing database (if any)
3. **Generates** secure passwords (first run only)
4. **Creates** all configuration files automatically
5. **Sets up** SSL certificate (Let's Encrypt or self-signed)
6. **Cleans** old containers/images to free space
7. **Builds** and deploys all services
8. **Initializes** database (first run only)
9. **Creates** admin user (first run only)
10. **Configures** firewall
11. **Verifies** everything works

---

## 🔐 Default Credentials

After first deployment:

- **Email:** `admin@yourdomain.com`
- **Password:** `Admin123!`

⚠️ **Change password immediately after first login!**

---

## 🔧 Useful Commands

```bash
# Check status
docker-compose -f docker-compose.demo.yml ps

# View logs
docker-compose -f docker-compose.demo.yml logs -f

# Restart services
docker-compose -f docker-compose.demo.yml restart

# Check backend health
curl http://localhost:3000/health

# Access database
docker exec -it ai-dialer-postgres psql -U ai_dialer_user -d ai_dialer_prod
```

---

## 🚨 Troubleshooting

### Services won't start
```bash
docker-compose -f docker-compose.demo.yml logs -f
```

### Domain not accessible
- Check DNS propagation: `nslookup yourdomain.com`
- Check AWS Security Group (ports 80, 443 open)
- Check firewall: `sudo ufw status`

### Out of disk space
```bash
# Clean Docker resources
docker system prune -a -f

# Clean old backups
find backups -name "*.sql.gz" -mtime +30 -delete
```

---

## 📞 AWS Security Group Ports

Ensure these ports are open:

```
22          SSH
80          HTTP
443         HTTPS
3000        Backend API
3001        Frontend
5060/UDP    SIP
8088        Asterisk ARI
10000-10100/UDP  RTP Media
```

---

## ✅ That's All You Need!

1. **First time:** Edit domain → Run `./deploy.sh`
2. **Updates:** `git pull` → Run `./deploy.sh`

Everything else is automatic! 🚀

For detailed documentation, see: `PRODUCTION_DEPLOYMENT.md`
