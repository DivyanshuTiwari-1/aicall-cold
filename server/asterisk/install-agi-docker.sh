#!/bin/bash
# AI Dialer AGI Scripts Installation Script for Docker
# This script sets up the AGI scripts for Asterisk integration in Docker

echo "Installing AI Dialer AGI Scripts in Docker..."

# Check if Asterisk container is running
if ! docker ps | grep -q "asterisk"; then
    echo "Error: Asterisk container is not running!"
    echo "Please start the Asterisk container first with: docker-compose up -d asterisk"
    exit 1
fi

# Create AGI directory in container
echo "Creating AGI directory in Asterisk container..."
docker exec asterisk mkdir -p /var/lib/asterisk/agi-bin

# Copy AGI scripts to container
echo "Copying AGI scripts to Asterisk container..."
docker cp ai-dialer-agi.php asterisk:/var/lib/asterisk/agi-bin/
docker cp ai-dialer-hangup-agi.php asterisk:/var/lib/asterisk/agi-bin/
docker cp ai-inbound-agi.php asterisk:/var/lib/asterisk/agi-bin/

# Make scripts executable
echo "Setting executable permissions..."
docker exec asterisk chmod +x /var/lib/asterisk/agi-bin/ai-*.php

# Create temporary directories
echo "Creating temporary directories..."
docker exec asterisk mkdir -p /tmp/audio-uploads
docker exec asterisk mkdir -p /tmp/tts

# Install PHP if not available
echo "Checking PHP installation..."
if ! docker exec asterisk php --version > /dev/null 2>&1; then
    echo "Installing PHP in Asterisk container..."
    docker exec asterisk apt-get update
    docker exec asterisk apt-get install -y php-cli php-curl
fi

# Test AGI scripts
echo "Testing AGI scripts installation..."
if docker exec asterisk test -f /var/lib/asterisk/agi-bin/ai-dialer-agi.php; then
    echo "✅ ai-dialer-agi.php installed successfully"
else
    echo "❌ Failed to install ai-dialer-agi.php"
fi

if docker exec asterisk test -f /var/lib/asterisk/agi-bin/ai-dialer-hangup-agi.php; then
    echo "✅ ai-dialer-hangup-agi.php installed successfully"
else
    echo "❌ Failed to install ai-dialer-hangup-agi.php"
fi

if docker exec asterisk test -f /var/lib/asterisk/agi-bin/ai-inbound-agi.php; then
    echo "✅ ai-inbound-agi.php installed successfully"
else
    echo "❌ Failed to install ai-inbound-agi.php"
fi

# Test PHP execution
echo "Testing PHP execution..."
if docker exec asterisk php -v > /dev/null 2>&1; then
    echo "✅ PHP is working correctly"
else
    echo "❌ PHP is not working correctly"
fi

echo ""
echo "AGI Scripts Installation Complete!"
echo ""
echo "Next steps:"
echo "1. Restart Asterisk container: docker-compose restart asterisk"
echo "2. Check Asterisk logs: docker logs asterisk"
echo "3. Test the AI dialer by starting a call from the web interface"
echo ""
echo "Configuration:"
echo "- AGI scripts location: /var/lib/asterisk/agi-bin"
echo "- API URL: http://ai_dialer:3000/api/v1"
echo "- Temp directories: /tmp/audio-uploads, /tmp/tts"
