# Production Dockerfile for AI Dialer Backend
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads logs audio-cache

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node healthcheck.js

# Start application
CMD ["node", "index.js"]
