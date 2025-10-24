#!/bin/bash
# Setup Cloudflare Tunnel for instant HTTPS

echo "🚀 Setting up Cloudflare Tunnel..."

# Install cloudflared
echo "📥 Installing cloudflared..."
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
rm cloudflared-linux-amd64.deb

echo ""
echo "✅ Cloudflared installed!"
echo ""
echo "🌐 Starting tunnel to http://localhost:3001"
echo "⚡ You'll get a HTTPS URL in a few seconds..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start tunnel (this will run in foreground and show the URL)
cloudflared tunnel --url http://localhost:3001
