#!/bin/bash
# Install Cloudflare Tunnel as System Service (Auto-starts on reboot)

TUNNEL_NAME="aidialer-prod"

echo "⚙️  Installing Cloudflare Tunnel as System Service"
echo "=================================================="
echo ""

# Check if tunnel exists
if ! cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo "❌ Tunnel not found. Please run setup first:"
    echo "   bash setup-permanent-tunnel.sh"
    exit 1
fi

echo "📝 Installing service..."

# Install service
sudo cloudflared service install

# Enable and start service
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

echo ""
echo "✅ SERVICE INSTALLED!"
echo ""
echo "📌 Tunnel will now:"
echo "   ✅ Auto-start on server reboot"
echo "   ✅ Auto-restart if it crashes"
echo "   ✅ Run in background always"
echo ""
echo "🔍 Useful commands:"
echo "   Status:  sudo systemctl status cloudflared"
echo "   Stop:    sudo systemctl stop cloudflared"
echo "   Start:   sudo systemctl start cloudflared"
echo "   Restart: sudo systemctl restart cloudflared"
echo "   Logs:    sudo journalctl -u cloudflared -f"
echo ""
