# Production SSL Setup - FAST

## Option 1: Use Cloudflare Tunnel (FASTEST - No Domain Needed) ⚡

1. Install cloudflared:
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

2. Login and create tunnel:
```bash
cloudflared tunnel login
cloudflared tunnel create aidialer
cloudflared tunnel route dns aidialer aidialer.youraccount.workers.dev
```

3. Run tunnel:
```bash
cloudflared tunnel --url http://localhost:3001
```

You get: **https://aidialer.youraccount.workers.dev** (FREE with valid SSL)

---

## Option 2: Buy Domain + Let's Encrypt (BEST for Production) 🎯

1. **Buy domain** (Namecheap/GoDaddy): $10/year
2. **Point A record** to: 13.53.89.241
3. **Run on server**:
```bash
cd /opt/ai-dialer
bash setup-letsencrypt.sh
```

You get: **https://yourdomain.com** (FREE SSL, auto-renew)

---

## Option 3: Accept Self-Signed (Development Only) 🔧

For testing only:
1. Click "Advanced"
2. Click "Proceed to 13.53.89.241 (unsafe)"
3. Works perfectly, just shows warning

---

## RECOMMENDATION:
**Use Cloudflare Tunnel** - Takes 2 minutes, completely free, professional SSL!

