#!/bin/bash
# Generate self-signed SSL certificate for HTTPS

echo "🔐 Generating self-signed SSL certificate..."

# Create ssl directory if it doesn't exist
mkdir -p ./ssl

# Generate private key and certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ./ssl/nginx-selfsigned.key \
    -out ./ssl/nginx-selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=AI Dialer/OU=IT/CN=13.53.89.241"

# Create dhparam for additional security (optional but recommended)
openssl dhparam -out ./ssl/dhparam.pem 2048

# Set proper permissions
chmod 600 ./ssl/nginx-selfsigned.key
chmod 644 ./ssl/nginx-selfsigned.crt
chmod 644 ./ssl/dhparam.pem

echo "✅ SSL certificates generated in ./ssl/"
echo "📝 Files created:"
echo "   - nginx-selfsigned.key (private key)"
echo "   - nginx-selfsigned.crt (certificate)"
echo "   - dhparam.pem (DH parameters)"
