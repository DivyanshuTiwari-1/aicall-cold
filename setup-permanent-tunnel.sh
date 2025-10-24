#!/bin/bash
# Setup Permanent Cloudflare Tunnel with Custom Domain

echo "🌐 Setting up Permanent Cloudflare Tunnel"
echo "=========================================="
echo ""
echo "This will create a permanent URL that never changes!"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "📥 Installing cloudflared..."
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared-linux-amd64.deb
    rm cloudflared-linux-amd64.deb
fi

echo "✅ Cloudflared installed"
echo ""

# Login to Cloudflare
echo "🔐 Step 1: Login to Cloudflare"
echo "A browser window will open. Please login to your Cloudflare account."
echo ""
read -p "Press ENTER to continue..."

cloudflared tunnel login

echo ""
echo "✅ Logged in to Cloudflare"
echo ""

# Create tunnel
TUNNEL_NAME="aidialer-prod"
echo "🔧 Step 2: Creating tunnel '$TUNNEL_NAME'..."

# Check if tunnel already exists
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo "⚠️  Tunnel '$TUNNEL_NAME' already exists. Using existing tunnel."
else
    cloudflared tunnel create $TUNNEL_NAME
    echo "✅ Tunnel created"
fi

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
echo "📝 Tunnel ID: $TUNNEL_ID"
echo ""

# Get tunnel credentials path
TUNNEL_CREDS_FILE="$HOME/.cloudflared/$TUNNEL_ID.json"

# Create config directory
mkdir -p $HOME/.cloudflared

# Create tunnel config file
echo "📝 Creating tunnel configuration..."
cat > $HOME/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: $TUNNEL_CREDS_FILE

ingress:
  - hostname: "*.trycloudflare.com"
    service: http://localhost:3001
  - service: http_status:404
EOF

echo "✅ Configuration created"
echo ""

# Setup DNS (optional - only if you have a custom domain)
echo "🌐 Step 3: DNS Setup"
echo ""
echo "Do you have a custom domain? (e.g., yourdomain.com)"
read -p "Enter domain name (or press ENTER to use free Cloudflare subdomain): " CUSTOM_DOMAIN

if [ ! -z "$CUSTOM_DOMAIN" ]; then
    echo ""
    echo "Setting up DNS for $CUSTOM_DOMAIN..."
    read -p "Enter subdomain (e.g., 'aidialer' for aidialer.$CUSTOM_DOMAIN): " SUBDOMAIN
    FULL_DOMAIN="$SUBDOMAIN.$CUSTOM_DOMAIN"

    cloudflared tunnel route dns $TUNNEL_NAME $FULL_DOMAIN

    # Update config with custom domain
    cat > $HOME/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: $TUNNEL_CREDS_FILE

ingress:
  - hostname: $FULL_DOMAIN
    service: http://localhost:3001
  - service: http_status:404
EOF

    echo "✅ DNS configured for: https://$FULL_DOMAIN"
    echo ""
    echo "Your permanent URL: https://$FULL_DOMAIN"
else
    echo "Using free Cloudflare subdomain"
    FULL_DOMAIN="$TUNNEL_NAME.trycloudflare.com"
fi

echo ""
echo "=========================================="
echo "✅ PERMANENT TUNNEL SETUP COMPLETE!"
echo "=========================================="
echo ""
echo "📝 Tunnel Name: $TUNNEL_NAME"
echo "🆔 Tunnel ID: $TUNNEL_ID"
if [ ! -z "$CUSTOM_DOMAIN" ]; then
    echo "🌐 Your Permanent URL: https://$FULL_DOMAIN"
else
    echo "🌐 Running tunnel will show your permanent URL"
fi
echo ""
echo "🚀 To start the tunnel:"
echo "   cloudflared tunnel run $TUNNEL_NAME"
echo ""
echo "💡 Or use the helper script:"
echo "   bash start-permanent-tunnel.sh"
echo ""
echo "📌 The tunnel will automatically reconnect on server reboot if you:"
echo "   sudo cloudflared service install"
echo "   sudo systemctl start cloudflared"
echo ""
