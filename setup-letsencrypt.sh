#!/bin/bash
# Setup Let's Encrypt SSL with Certbot

echo "🔐 Setting up Let's Encrypt SSL..."

# Install certbot
sudo apt-get update
sudo apt-get install -y certbot

# Stop nginx to free port 80
docker stop ai-dialer-frontend

# Get SSL certificate (replace YOUR_DOMAIN with your actual domain)
read -p "Enter your domain name (e.g., aidialer.yourdomain.com): " DOMAIN

sudo certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Copy certificates
sudo mkdir -p ./ssl
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./ssl/nginx-selfsigned.crt
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./ssl/nginx-selfsigned.key
sudo chmod 644 ./ssl/nginx-selfsigned.crt
sudo chmod 600 ./ssl/nginx-selfsigned.key

# Create dhparam if doesn't exist
if [ ! -f ./ssl/dhparam.pem ]; then
    openssl dhparam -out ./ssl/dhparam.pem 2048
fi

echo "✅ Let's Encrypt SSL installed!"
echo "🚀 Now restart: docker-compose -f docker-compose.demo.yml up -d"

