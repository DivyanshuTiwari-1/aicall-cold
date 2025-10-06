# Database Setup Guide

## Option 1: Using Docker (Recommended)

### 1. Install Docker Desktop
- Download from: https://www.docker.com/products/docker-desktop/
- Install and start Docker Desktop

### 2. Start Database Services
```bash
# Navigate to your project directory
cd c:\coding\aicall

# Start only the database services
docker-compose up -d postgres redis

# Check if services are running
docker-compose ps
```

### 3. Create Environment File
```bash
# Copy the example environment file
copy server\env.example server\.env

# Edit the .env file with your settings
# The database will be available at localhost:5432
```

### 4. Run Database Migrations
```bash
# Install dependencies first
npm run install:all

# Run migrations to create tables
npm run migrate

# Optional: Seed with sample data
npm run seed
```

### 5. Start the Application
```bash
# Start both frontend and backend
npm run dev
```

## Option 2: Manual PostgreSQL Installation

### 1. Install PostgreSQL
- Download from: https://www.postgresql.org/download/windows/
- Install with default settings
- Remember the password you set for 'postgres' user

### 2. Create Database
```bash
# Open Command Prompt as Administrator
# Navigate to PostgreSQL bin directory (usually C:\Program Files\PostgreSQL\15\bin)
# Run:
psql -U postgres
# Enter your password when prompted

# In psql, run:
CREATE DATABASE ai_dialer;
\q
```

### 3. Update Environment File
```bash
# Copy environment file
copy server\env.example server\.env

# Edit server\.env and update:
DB_PASSWORD=your_postgres_password
```

### 4. Install Redis
- Download Redis for Windows from: https://github.com/microsoftarchive/redis/releases
- Or use Docker: `docker run -d -p 6379:6379 redis:alpine`

### 5. Run Application
```bash
npm run install:all
npm run migrate
npm run seed
npm run dev
```

## Option 3: Using Docker for Everything

```bash
# Start all services with Docker
docker-compose up -d

# This will start:
# - PostgreSQL database
# - Redis cache
# - Backend API
# - Frontend
# - pgAdmin (database management)
# - Redis Commander (cache management)
```

## Access Points After Setup

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Database Admin**: http://localhost:5050 (pgAdmin)
- **Redis Admin**: http://localhost:8081 (Redis Commander)

## Troubleshooting

### If PostgreSQL command not found:
- Make sure PostgreSQL is installed and added to PATH
- Or use Docker option instead

### If database connection fails:
- Check if PostgreSQL is running
- Verify credentials in .env file
- Check if port 5432 is available

### If Redis connection fails:
- Install Redis or use Docker: `docker run -d -p 6379:6379 redis:alpine`
