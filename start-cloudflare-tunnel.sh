#!/bin/bash
# Quick start Cloudflare Tunnel (after installation)

echo "🌐 Starting Cloudflare Tunnel..."
echo "⚡ Connecting to http://localhost:3001"
echo ""
cloudflared tunnel --url http://localhost:3001
GS
