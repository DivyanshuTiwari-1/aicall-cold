#!/bin/bash

# AI Dialer AGI Scripts Installation Script
# This script sets up the AGI scripts for Asterisk integration

echo "Installing AI Dialer AGI Scripts..."

# Set the directory where AGI scripts are located
AGI_DIR="/var/lib/asterisk/agi-bin"
SCRIPT_DIR="$(dirname "$0")"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script as root or with sudo"
    exit 1
fi

# Create AGI directory if it doesn't exist
if [ ! -d "$AGI_DIR" ]; then
    echo "Creating AGI directory: $AGI_DIR"
    mkdir -p "$AGI_DIR"
fi

# Copy AGI scripts to Asterisk AGI directory
echo "Copying AGI scripts to $AGI_DIR..."
cp "$SCRIPT_DIR/ai-dialer-agi.php" "$AGI_DIR/"
cp "$SCRIPT_DIR/ai-dialer-hangup-agi.php" "$AGI_DIR/"
cp "$SCRIPT_DIR/ai-inbound-agi.php" "$AGI_DIR/"

# Make scripts executable
echo "Setting executable permissions..."
chmod +x "$AGI_DIR/ai-dialer-agi.php"
chmod +x "$AGI_DIR/ai-dialer-hangup-agi.php"
chmod +x "$AGI_DIR/ai-inbound-agi.php"

# Set ownership to asterisk user
echo "Setting ownership to asterisk user..."
chown asterisk:asterisk "$AGI_DIR/ai-dialer-agi.php"
chown asterisk:asterisk "$AGI_DIR/ai-dialer-hangup-agi.php"
chown asterisk:asterisk "$AGI_DIR/ai-inbound-agi.php"

# Install PHP dependencies if needed
echo "Checking PHP dependencies..."
if ! php -m | grep -q "curl"; then
    echo "Installing PHP cURL extension..."
    apt-get update && apt-get install -y php-curl
fi

if ! php -m | grep -q "json"; then
    echo "Installing PHP JSON extension..."
    apt-get update && apt-get install -y php-json
fi

# Create temporary directories
echo "Creating temporary directories..."
mkdir -p /tmp/audio-uploads
mkdir -p /tmp/tts
chown asterisk:asterisk /tmp/audio-uploads
chown asterisk:asterisk /tmp/tts

# Test AGI scripts
echo "Testing AGI scripts..."
if [ -f "$AGI_DIR/ai-dialer-agi.php" ] && [ -x "$AGI_DIR/ai-dialer-agi.php" ]; then
    echo "✅ ai-dialer-agi.php installed successfully"
else
    echo "❌ Failed to install ai-dialer-agi.php"
fi

if [ -f "$AGI_DIR/ai-dialer-hangup-agi.php" ] && [ -x "$AGI_DIR/ai-dialer-hangup-agi.php" ]; then
    echo "✅ ai-dialer-hangup-agi.php installed successfully"
else
    echo "❌ Failed to install ai-dialer-hangup-agi.php"
fi

if [ -f "$AGI_DIR/ai-inbound-agi.php" ] && [ -x "$AGI_DIR/ai-inbound-agi.php" ]; then
    echo "✅ ai-inbound-agi.php installed successfully"
else
    echo "❌ Failed to install ai-inbound-agi.php"
fi

echo ""
echo "AGI Scripts Installation Complete!"
echo ""
echo "Next steps:"
echo "1. Restart Asterisk: systemctl restart asterisk"
echo "2. Check Asterisk logs: tail -f /var/log/asterisk/full"
echo "3. Test the AI dialer by starting a call from the web interface"
echo ""
echo "Configuration:"
echo "- AGI scripts location: $AGI_DIR"
echo "- API URL: http://localhost:3000/api/v1"
echo "- Temp directories: /tmp/audio-uploads, /tmp/tts"
