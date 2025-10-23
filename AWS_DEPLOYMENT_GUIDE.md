# AI Dialer Pro - AWS Deployment Guide

## 🚀 Deploy on AWS EC2 in 30 Minutes

Complete step-by-step guide for deploying AI Dialer on Amazon Web Services.

---

## Step 1: Create AWS Account (5 minutes)

### If you don't have an AWS account:

1. **Go to**: https://aws.amazon.com/
2. **Click**: "Create an AWS Account"
3. **Fill in**:
   - Email address
   - Password
   - AWS account name
4. **Verify**: Email and phone number
5. **Payment**: Add credit/debit card (required, but free tier available)
6. **Select**: Basic support plan (Free)

### Free Tier Benefits:
- **750 hours/month** of t2.micro or t3.micro (12 months)
- **For AI Dialer**: Use t3.medium ($0.0416/hour ≈ $30/month)
- **After free tier**: Still very affordable

---

## Step 2: Launch EC2 Instance (10 minutes)

### 2.1: Access EC2 Console

1. **Login to**: https://console.aws.amazon.com/
2. **Search**: "EC2" in the top search bar
3. **Click**: "EC2" to open EC2 Dashboard
4. **Region**: Select region closest to you (top-right corner)
   - Example: US East (N. Virginia), EU (Frankfurt), Asia Pacific (Singapore)

### 2.2: Launch Instance

1. **Click**: "Launch Instance" (big orange button)

2. **Name your instance**:
   ```
   Name: ai-dialer-demo
   ```

3. **Application and OS Images (AMI)**:
   - **Quick Start**: Ubuntu
   - **Ubuntu Server 22.04 LTS** (should be selected by default)
   - **Architecture**: 64-bit (x86)

4. **Instance Type**:
   - **Recommended**: `t3.medium`
     - 2 vCPUs
     - 4 GB RAM
     - $0.0416/hour (~$30/month)

   - **Or if on budget**: `t3.small`
     - 2 vCPUs
     - 2 GB RAM
     - $0.0208/hour (~$15/month)
     - ⚠️ May be slow with many calls

   - **Or if testing free tier**: `t3.micro`
     - 2 vCPUs
     - 1 GB RAM
     - FREE for 12 months
     - ⚠️ Limited performance

5. **Key pair (login)**:

   **Option A - Create new key pair (Recommended):**
   - Click "Create new key pair"
   - **Key pair name**: `ai-dialer-key`
   - **Key pair type**: RSA
   - **Private key file format**:
     - **Windows**: `.ppk` (for PuTTY)
     - **Mac/Linux**: `.pem`
   - Click "Create key pair"
   - **IMPORTANT**: Save the downloaded file! You'll need it to connect.

   **Option B - Use existing key pair:**
   - Select from dropdown if you have one

6. **Network Settings**:

   Click "Edit" and configure:

   - **Auto-assign public IP**: Enable

   - **Firewall (security groups)**: Create security group

   - **Security group name**: `ai-dialer-sg`

   - **Description**: `Security group for AI Dialer`

   - **Add these rules** (click "Add security group rule" for each):

   | Type | Protocol | Port Range | Source | Description |
   |------|----------|------------|--------|-------------|
   | SSH | TCP | 22 | My IP | SSH access |
   | Custom TCP | TCP | 3000 | Anywhere (0.0.0.0/0) | Backend API |
   | Custom TCP | TCP | 3001 | Anywhere (0.0.0.0/0) | Frontend |
   | Custom TCP | TCP | 8088 | My IP | Asterisk ARI |
   | Custom UDP | UDP | 5060 | Anywhere (0.0.0.0/0) | SIP |
   | Custom UDP | UDP | 10000-10100 | Anywhere (0.0.0.0/0) | RTP Media |

7. **Configure Storage**:
   - **Size**: 30 GB (minimum)
   - **Recommended**: 50 GB
   - **Volume Type**: gp3 (General Purpose SSD)
   - **Delete on termination**: Checked (recommended)

8. **Advanced Details** (Optional):
   - Leave as default for now
   - You can add IAM roles later if needed

9. **Review and Launch**:
   - **Summary**: Review your configuration on the right side
   - **Number of instances**: 1
   - **Click**: "Launch instance"

### 2.3: Wait for Instance to Start

1. Click "View all instances"
2. Wait until:
   - **Instance State**: Running ✅
   - **Status Check**: 2/2 checks passed ✅
   - This takes 1-2 minutes

### 2.4: Get Your Server Information

In the EC2 Instances dashboard:

1. **Select** your instance (checkbox)
2. **Note these details** (bottom panel):
   - **Public IPv4 address**: e.g., `18.191.123.45` ← **This is your SERVER_IP!**
   - **Public IPv4 DNS**: e.g., `ec2-18-191-123-45.us-east-2.compute.amazonaws.com`
   - **Instance ID**: e.g., `i-0123456789abcdef`

**Write down your Public IPv4 address - you'll need it!**

---

## Step 3: Connect to Your EC2 Instance

### Method A: Using Windows (PuTTY + WinSCP)

#### 3.1: Convert key file (if needed)

If you downloaded `.ppk` file, skip to 3.2.

If you downloaded `.pem` file:

1. **Download PuTTYgen**: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html
2. **Open PuTTYgen**
3. **Click**: "Load"
4. **Select**: Your `.pem` file (change filter to "All Files")
5. **Click**: "Save private key"
6. **Save as**: `ai-dialer-key.ppk`

#### 3.2: Connect with PuTTY

1. **Download PuTTY**: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html
2. **Open PuTTY**
3. **Configuration**:
   - **Host Name**: `ubuntu@YOUR_PUBLIC_IP`
   - Example: `ubuntu@18.191.123.45`
   - **Port**: 22
   - **Connection type**: SSH
4. **Left menu**: Connection → SSH → Auth → Credentials
5. **Private key file**: Browse and select your `.ppk` file
6. **Optional**: Save session for later
   - Go back to "Session"
   - **Saved Sessions**: Type "ai-dialer"
   - Click "Save"
7. **Click**: "Open"
8. **Security Alert**: Click "Accept" (first time only)

You should now see:
```
Welcome to Ubuntu 22.04 LTS
ubuntu@ip-172-31-xx-xx:~$
```

#### 3.3: Upload Files with WinSCP

1. **Download WinSCP**: https://winscp.net/
2. **Open WinSCP**
3. **New Site**:
   - **File protocol**: SFTP
   - **Host name**: YOUR_PUBLIC_IP (e.g., `18.191.123.45`)
   - **Port**: 22
   - **User name**: `ubuntu`
4. **Advanced** → **SSH** → **Authentication**:
   - **Private key file**: Select your `.ppk` file
5. **Click**: "Login"
6. **Navigate**:
   - **Left side**: `C:\coding\aicall\`
   - **Right side**: Create folder `/home/ubuntu/ai-dialer`
7. **Upload**: Drag all files from left to right
8. **Wait**: For upload to complete (may take 5-10 minutes)

### Method B: Using Mac/Linux (Terminal)

#### 3.1: Set key permissions

```bash
# Open Terminal
cd ~/Downloads  # Or wherever you saved the key

# Set proper permissions
chmod 400 ai-dialer-key.pem
```

#### 3.2: Connect via SSH

```bash
# Connect to instance
ssh -i ai-dialer-key.pem ubuntu@YOUR_PUBLIC_IP

# Example:
ssh -i ai-dialer-key.pem ubuntu@18.191.123.45

# Type 'yes' when asked about authenticity
```

#### 3.3: Upload files

```bash
# From your local machine (new terminal window)
cd /path/to/your/project

# Upload files
scp -i ~/Downloads/ai-dialer-key.pem -r ./* ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/ai-dialer/

# Example:
scp -i ~/Downloads/ai-dialer-key.pem -r ./* ubuntu@18.191.123.45:/home/ubuntu/ai-dialer/
```

### Method C: Using AWS CloudShell (No key needed!)

1. **In AWS Console**: Click the CloudShell icon (>_) in the top toolbar
2. **Upload files**:
   - Click "Actions" → "Upload files"
   - Select all your project files
3. **Connect to instance**:
   ```bash
   # Get instance ID from EC2 dashboard
   aws ec2-instance-connect ssh --instance-id i-YOUR_INSTANCE_ID
   ```

---

## Step 4: Setup and Deploy (10 minutes)

### 4.1: SSH to your instance (if not already connected)

```bash
ssh -i ai-dialer-key.pem ubuntu@YOUR_PUBLIC_IP
```

### 4.2: Move files to correct location

```bash
# Create directory
sudo mkdir -p /opt/ai-dialer

# Move uploaded files
sudo mv /home/ubuntu/ai-dialer/* /opt/ai-dialer/

# Set ownership
sudo chown -R ubuntu:ubuntu /opt/ai-dialer

# Navigate to directory
cd /opt/ai-dialer
```

### 4.3: Run the automated deployment

```bash
# Make script executable
chmod +x deploy-demo.sh

# Run deployment
./deploy-demo.sh
```

**The script will:**
1. ✅ Auto-detect your server IP
2. ✅ Install Docker and Docker Compose
3. ✅ Generate all secure passwords
4. ✅ Ask for Telnyx credentials (you can skip for now)
5. ✅ Configure firewall
6. ✅ Build and start all services
7. ✅ Run database migrations
8. ✅ Create admin user
9. ✅ Show access URLs

**Wait**: 10-15 minutes for everything to complete

### 4.4: When prompted:

```
Enter Telnyx API Key (or press Enter to skip): [Press Enter]
Enter Telnyx SIP Username (or press Enter to skip): [Press Enter]
Enter Telnyx SIP Password (or press Enter to skip): [Press Enter]
Enter Telnyx Phone Number (or press Enter to skip): [Press Enter]
```

You can add Telnyx credentials later!

---

## Step 5: Access Your AI Dialer! 🎉

### After deployment completes:

**Open in your browser:**
```
http://YOUR_PUBLIC_IP:3001
```

**Example:**
```
http://18.191.123.45:3001
```

### Login Credentials:
- **Email**: `admin@demo.com`
- **Password**: `Admin123!`

### APIs:
- **Backend API**: `http://YOUR_PUBLIC_IP:3000`
- **Health Check**: `http://YOUR_PUBLIC_IP:3000/health`

---

## Step 6: Configure Telnyx (Optional - For Making Calls)

### 6.1: Get Telnyx Account

1. Go to: https://telnyx.com/
2. Sign up for free trial ($10 credit)
3. Verify your account

### 6.2: Get API Key

1. **Login to**: https://portal.telnyx.com/
2. **Navigate**: API Keys (left menu)
3. **Click**: "Create API Key"
4. **Name**: "AI Dialer"
5. **Copy**: The API key (starts with `KEY...`)
6. **Save**: Keep it secure!

### 6.3: Create SIP Connection

1. **Navigate**: Voice → SIP Connections
2. **Click**: "Create SIP Connection"
3. **Connection Name**: "AI Dialer"
4. **Connection Type**: Credentials-based
5. **Click**: "Create"
6. **Settings**:
   - **Authentication**: Enabled
   - **Username**: Create a username (save it!)
   - **Password**: Create a password (save it!)
7. **IP Access Control**:
   - Click "Add IP"
   - Enter your AWS instance public IP
   - Click "Save"

### 6.4: Buy Phone Number

1. **Navigate**: Numbers → Phone Numbers
2. **Click**: "Buy Numbers"
3. **Search**: Your country/area code
4. **Select**: A number you like
5. **Click**: "Buy"
6. **Assign to**: Your SIP Connection
7. **Save**: The phone number

### 6.5: Add Credentials to AI Dialer

```bash
# SSH back to your instance
ssh -i ai-dialer-key.pem ubuntu@YOUR_PUBLIC_IP

# Edit environment file
cd /opt/ai-dialer
nano .env.production
```

**Update these lines:**
```bash
TELNYX_API_KEY=KEY...your_api_key_here...
TELNYX_SIP_USERNAME=your_username_here
TELNYX_SIP_PASSWORD=your_password_here
TELNYX_DID=+1234567890
TELNYX_PHONE_NUMBER=+1234567890
TELNYX_CALLER_ID=+1234567890
```

**Save**: `Ctrl+X`, `Y`, `Enter`

**Restart services:**
```bash
docker-compose -f docker-compose.demo.yml restart backend
```

---

## AWS-Specific Tips

### Monitor Costs

1. **Billing Dashboard**: https://console.aws.amazon.com/billing/
2. **Set up billing alerts**:
   - Billing → Budgets
   - Create budget
   - Set threshold (e.g., $50/month)
   - Get email alerts

### Estimate Monthly Cost

| Item | Cost |
|------|------|
| t3.medium instance | $30/month |
| 50 GB EBS storage | $5/month |
| Data transfer (first 100GB) | FREE |
| **Total** | **~$35/month** |

**Note**: Stop instance when not in use to save money!

### Stop Instance (Save Money)

**To stop** (keeps data, stops charges):
```bash
# In AWS Console
EC2 → Instances → Select instance → Instance State → Stop
```

**To start again**:
```bash
EC2 → Instances → Select instance → Instance State → Start
```

⚠️ **Public IP may change** after stop/start. Use Elastic IP to keep same IP.

### Allocate Elastic IP (Keep Same IP)

1. **EC2 Console** → Elastic IPs
2. **Allocate Elastic IP address**
3. **Associate**: With your instance
4. **Benefit**: IP won't change when you stop/start
5. **Cost**: FREE if instance is running, $0.005/hour if stopped

### Create AMI (Backup)

1. **EC2 Console** → Instances
2. **Select** your instance
3. **Actions** → Image and templates → Create image
4. **Image name**: `ai-dialer-backup-2024-10-23`
5. **Create image**
6. **Use**: To restore or launch new instances

---

## Troubleshooting AWS-Specific Issues

### Can't connect via SSH

**Problem**: "Connection timed out"

**Solutions**:
1. Check security group allows port 22 from your IP
2. Verify instance is running
3. Check you're using correct key file
4. Try from different network (coffee shop wifi, mobile hotspot)

### Can't access web interface

**Problem**: "Site can't be reached"

**Solutions**:
1. **Verify instance is running**:
   ```bash
   EC2 → Instances → Check "Instance state"
   ```

2. **Check security group**:
   - Ports 3000 and 3001 open to 0.0.0.0/0

3. **Verify services are running**:
   ```bash
   ssh to instance
   docker ps
   # Should see 5 containers
   ```

4. **Check public IP hasn't changed**:
   - EC2 → Instances → Get current public IP
   - Use Elastic IP to prevent changes

### Out of storage

**Problem**: "No space left on device"

**Solutions**:
1. **Increase EBS volume**:
   - EC2 → Volumes
   - Select volume → Actions → Modify volume
   - Increase size to 100 GB
   - Extend filesystem:
     ```bash
     sudo growpart /dev/xvda 1
     sudo resize2fs /dev/xvda1
     ```

2. **Clean up**:
   ```bash
   docker system prune -a
   ```

### High CPU usage

**Problem**: Instance running slow

**Solutions**:
1. **Upgrade instance type**:
   - Stop instance
   - Actions → Instance settings → Change instance type
   - Select t3.large
   - Start instance

2. **Enable monitoring**:
   - EC2 → Instances → Monitoring tab
   - View CPU, memory, network graphs

---

## Security Best Practices for AWS

### 1. Restrict SSH Access

Only allow SSH from your IP:
```bash
# In Security Group
Edit Inbound Rules:
SSH | TCP | 22 | My IP (auto-detected)
```

### 2. Enable CloudWatch Logs

```bash
# Install CloudWatch agent
sudo wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
```

### 3. Setup Automatic Backups

Use AWS Backup or create snapshots:
```bash
EC2 → Elastic Block Store → Snapshots → Create snapshot
```

### 4. Use IAM Roles

Instead of hardcoding AWS credentials, use IAM roles for services.

### 5. Enable VPC Flow Logs

Monitor network traffic for security analysis.

---

## Quick Reference Commands

### Connect to instance:
```bash
ssh -i ai-dialer-key.pem ubuntu@YOUR_PUBLIC_IP
```

### View logs:
```bash
cd /opt/ai-dialer
docker-compose -f docker-compose.demo.yml logs -f
```

### Restart services:
```bash
docker-compose -f docker-compose.demo.yml restart
```

### Stop all:
```bash
docker-compose -f docker-compose.demo.yml down
```

### Start all:
```bash
docker-compose -f docker-compose.demo.yml up -d
```

### Check status:
```bash
docker ps
```

### Backup database:
```bash
docker exec ai-dialer-postgres pg_dump -U ai_dialer_user ai_dialer_prod > backup.sql
```

---

## Next Steps

1. ✅ **Test the system**: Login and explore
2. ✅ **Add Telnyx credentials**: For making calls
3. ✅ **Upload contacts**: CSV import
4. ✅ **Create campaign**: Test automated calling
5. ✅ **Monitor costs**: Set up billing alerts
6. ✅ **Create backup**: AMI snapshot
7. ✅ **Setup Elastic IP**: Keep same IP address

---

## Summary Checklist

- [ ] AWS account created
- [ ] EC2 instance launched (t3.medium or larger)
- [ ] Security group configured (ports 22, 3000, 3001, 5060, 8088, 10000-10100)
- [ ] Key pair created and downloaded
- [ ] Connected to instance via SSH
- [ ] Files uploaded to `/opt/ai-dialer`
- [ ] `deploy-demo.sh` executed successfully
- [ ] Can access `http://YOUR_IP:3001`
- [ ] Logged in as admin
- [ ] Telnyx credentials added (optional)
- [ ] Elastic IP allocated (recommended)
- [ ] Billing alert configured
- [ ] AMI backup created

---

## Cost Optimization Tips

1. **Stop instance** when not demoing (saves ~$30/month)
2. **Use t3.small** if low call volume ($15/month vs $30)
3. **Set up auto-shutdown**:
   ```bash
   # Add to crontab
   0 18 * * * sudo shutdown -h now
   ```
4. **Monitor with Cost Explorer**
5. **Delete unused snapshots**
6. **Use Reserved Instances** for long-term (save 40-60%)

---

## Support

- **AWS Support**: https://console.aws.amazon.com/support/
- **AWS Documentation**: https://docs.aws.amazon.com/ec2/
- **Telnyx Support**: https://telnyx.com/support
- **AI Dialer Docs**: See other guides in repository

---

**You're ready to deploy on AWS!** 🚀

Total time: ~30 minutes from start to accessing your demo.
