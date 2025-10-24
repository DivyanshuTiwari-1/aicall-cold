#!/bin/bash
# Start Permanent Cloudflare Tunnel

TUNNEL_NAME="aidialer-prod"

echo "🚀 Starting permanent Cloudflare Tunnel: $TUNNEL_NAME"
echo ""

# Check if tunnel exists
if ! cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo "❌ Tunnel not found. Please run setup first:"
    echo "   bash setup-permanent-tunnel.sh"
    exit 1
fi

echo "✅ Tunnel found"
echo "🌐 Connecting..."
echo ""

# Run tunnel
cloudflared tunnel run $TUNNEL_NAME

