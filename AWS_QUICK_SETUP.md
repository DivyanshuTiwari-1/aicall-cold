# AWS EC2 - Quick Setup Cheat Sheet

## 🎯 Deploy AI Dialer on AWS in 4 Steps

---

## Step 1: Launch EC2 Instance (5 min)

### Go to: https://console.aws.amazon.com/ec2/

1. **Click**: "Launch Instance"

2. **Configure**:
   ```
   Name: ai-dialer-demo

   OS: Ubuntu Server 22.04 LTS

   Instance Type: t3.medium
   - 2 vCPUs, 4 GB RAM
   - $0.0416/hour (~$30/month)

   Key pair: Create new
   - Name: ai-dialer-key
   - Type: RSA
   - Format: .ppk (Windows) or .pem (Mac/Linux)
   - Download and save!

   Storage: 30-50 GB gp3
   ```

3. **Security Group** - Add these rules:

   | Port | Type | Source | Description |
   |------|------|--------|-------------|
   | 22 | SSH | My IP | SSH access |
   | 3000 | TCP | 0.0.0.0/0 | Backend API |
   | 3001 | TCP | 0.0.0.0/0 | Frontend |
   | 5060 | UDP | 0.0.0.0/0 | SIP |
   | 8088 | TCP | My IP | Asterisk ARI |
   | 10000-10100 | UDP | 0.0.0.0/0 | RTP Media |

4. **Click**: "Launch instance"

5. **Get your IP**:
   - Wait 1-2 minutes
   - Copy "Public IPv4 address" (e.g., `18.191.123.45`)

---

## Step 2: Connect to Instance (2 min)

### Windows (PuTTY):

1. **Download PuTTY**: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html

2. **Open PuTTY**:
   ```
   Host Name: ubuntu@YOUR_PUBLIC_IP
   Port: 22
   Connection type: SSH

   Connection → SSH → Auth → Credentials:
   Private key file: Browse to your .ppk file

   Click "Open"
   ```

### Mac/Linux (Terminal):

```bash
chmod 400 ~/Downloads/ai-dialer-key.pem

ssh -i ~/Downloads/ai-dialer-key.pem ubuntu@YOUR_PUBLIC_IP
```

---

## Step 3: Upload Files (5 min)

### Windows (WinSCP):

1. **Download WinSCP**: https://winscp.net/

2. **Connect**:
   ```
   Protocol: SFTP
   Host: YOUR_PUBLIC_IP
   Port: 22
   User: ubuntu
   Private key: Your .ppk file
   ```

3. **Upload**:
   - Left: `C:\coding\aicall\`
   - Right: `/home/ubuntu/ai-dialer`
   - Drag files from left to right

### Mac/Linux (SCP):

```bash
cd /path/to/your/aicall/project

scp -i ~/Downloads/ai-dialer-key.pem -r ./* ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/ai-dialer/
```

---

## Step 4: Deploy! (10 min)

### On the server (via SSH):

```bash
# Move files
sudo mkdir -p /opt/ai-dialer
sudo mv /home/ubuntu/ai-dialer/* /opt/ai-dialer/
sudo chown -R ubuntu:ubuntu /opt/ai-dialer
cd /opt/ai-dialer

# Run deployment
chmod +x deploy-demo.sh
./deploy-demo.sh

# When asked for Telnyx credentials, press Enter to skip (can add later)
```

**Wait 10-15 minutes for deployment to complete**

---

## Step 5: Access Your Demo! 🎉

### Open in browser:

```
http://YOUR_PUBLIC_IP:3001
```

**Example:**
```
http://18.191.123.45:3001
```

### Login:
```
Email:    admin@demo.com
Password: Admin123!
```

---

## Quick Commands

```bash
# Connect to instance
ssh -i ai-dialer-key.pem ubuntu@YOUR_PUBLIC_IP

# View logs
cd /opt/ai-dialer
docker-compose -f docker-compose.demo.yml logs -f

# Restart services
docker-compose -f docker-compose.demo.yml restart

# Stop services (save money)
docker-compose -f docker-compose.demo.yml down

# Start services
docker-compose -f docker-compose.demo.yml up -d

# Check status
docker ps
```

---

## AWS Console Quick Links

- **EC2 Dashboard**: https://console.aws.amazon.com/ec2/
- **View Instances**: https://console.aws.amazon.com/ec2/v2/home#Instances
- **Security Groups**: https://console.aws.amazon.com/ec2/v2/home#SecurityGroups
- **Billing**: https://console.aws.amazon.com/billing/

---

## Save Money

### Stop instance when not in use:
```
EC2 Console → Instances → Select → Instance State → Stop
```
**Saves**: ~$30/month when stopped
**Note**: Public IP may change (use Elastic IP to keep it)

### Allocate Elastic IP (keep same IP):
```
EC2 Console → Elastic IPs → Allocate → Associate with instance
```
**Cost**: FREE when instance running

### Set billing alert:
```
Billing → Budgets → Create budget
Set: $50/month threshold
Enable: Email alerts
```

---

## Costs Breakdown

| Item | Cost |
|------|------|
| t3.medium instance (running) | $30/month |
| 50 GB storage | $5/month |
| Data transfer (100GB free) | $0 |
| **Total** | **$35/month** |

**When stopped**: Only pay for storage (~$5/month)

---

## Troubleshooting

### Can't connect via SSH?
1. Check security group allows port 22
2. Verify using correct key file
3. Make sure instance is running
4. Try: `ssh -v -i key.pem ubuntu@IP` for debug info

### Can't access website?
1. Verify ports 3000, 3001 open in security group
2. Check instance is running: `docker ps`
3. Verify correct public IP (check AWS console)
4. Wait 2-3 minutes after deployment

### Services not starting?
```bash
# Check logs
docker-compose -f docker-compose.demo.yml logs

# Restart everything
docker-compose -f docker-compose.demo.yml down
docker-compose -f docker-compose.demo.yml up -d
```

### Out of storage?
```bash
# Clean Docker
docker system prune -a

# Or increase EBS volume in AWS console
```

---

## Security Checklist

- [ ] SSH restricted to "My IP" only
- [ ] Key file saved securely (not in public folder)
- [ ] Billing alerts configured
- [ ] AMI backup created
- [ ] Elastic IP allocated (optional)
- [ ] Password changed from default

---

## Next Steps

1. ✅ **Test login**: http://YOUR_IP:3001
2. ✅ **Add Telnyx**: For making calls
3. ✅ **Upload contacts**: Test CSV import
4. ✅ **Create campaign**: Test automated calls
5. ✅ **Create backup**: AMI snapshot
6. ✅ **Monitor costs**: Check billing dashboard

---

## Add Telnyx Later

```bash
# SSH to instance
ssh -i ai-dialer-key.pem ubuntu@YOUR_PUBLIC_IP

# Edit config
cd /opt/ai-dialer
nano .env.production

# Update these lines:
TELNYX_API_KEY=your_key_here
TELNYX_SIP_USERNAME=your_username
TELNYX_SIP_PASSWORD=your_password
TELNYX_DID=+1234567890

# Save: Ctrl+X, Y, Enter

# Restart
docker-compose -f docker-compose.demo.yml restart backend
```

---

## Full Guides Available

- **Detailed AWS Guide**: `AWS_DEPLOYMENT_GUIDE.md`
- **General Demo Guide**: `DEMO_DEPLOYMENT_IP_ONLY.md`
- **Quick Reference**: `DEPLOY_DEMO_CHEATSHEET.md`
- **Production Guide**: `PRODUCTION_DEPLOYMENT_GUIDE.md`

---

**Total Time**: ~25 minutes from AWS account to working demo

**Questions?** Check `AWS_DEPLOYMENT_GUIDE.md` for detailed help!

🚀 **Happy deploying!**
