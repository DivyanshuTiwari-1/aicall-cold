# AI Dialer Pro - Development Guide

## Hot Reloading Setup

This project supports hot reloading for both local development and Docker development environments.

## Development Options

### Option 1: Local Development (Recommended for Frontend Development)

Run the frontend and backend locally for the fastest development experience:

```bash
# Install all dependencies
npm run install:all

# Start both frontend and backend with hot reloading
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Database: PostgreSQL on port 5433
- Redis: Port 6379

### Option 2: Docker Development (Full Stack)

Run everything in Docker with hot reloading:

```bash
# Start all services with hot reloading
npm run dev:docker

# View logs
npm run dev:docker:logs

# Stop services
npm run dev:docker:down
```

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Database: PostgreSQL on port 5433
- Redis: Port 6379
- Asterisk: Port 5060 (SIP), 8088 (ARI)

## Hot Reloading Features

### Frontend Hot Reloading
- ✅ React Fast Refresh enabled
- ✅ CSS changes reflect immediately
- ✅ Component state preserved during updates
- ✅ File watching with polling for Docker compatibility

### Backend Hot Reloading
- ✅ Nodemon automatically restarts server on changes
- ✅ Database migrations run automatically
- ✅ Logs stream in real-time

### Volume Mounts
- `./client:/app` - Frontend source code
- `.:/usr/src/app` - Backend source code
- `./asterisk-config:/etc/asterisk` - Asterisk configuration
- `./logs:/usr/src/app/logs` - Application logs

## Environment Variables

### Frontend (.env.local)
```env
REACT_APP_API_URL=http://localhost:3000/api/v1
```

### Backend (.env)
```env
NODE_ENV=development
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ai_dialer
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=redis
REDIS_PORT=6379
```

## Troubleshooting

### Hot Reloading Not Working

1. **Docker on Windows/Mac**: Ensure file sharing is enabled
2. **Permission Issues**: Check file permissions on mounted volumes
3. **Port Conflicts**: Ensure ports 3000, 3001, 5433, 6379 are available

### Frontend Not Updating

1. Check if `CHOKIDAR_USEPOLLING=true` is set in docker-compose.dev.yml
2. Verify volume mounts are correct
3. Check browser console for errors

### Backend Not Restarting

1. Verify nodemon is installed: `npm list nodemon`
2. Check server logs: `npm run dev:docker:logs`
3. Ensure file changes are being detected

## File Structure

```
├── client/                 # React frontend
│   ├── Dockerfile.dev     # Development Dockerfile
│   ├── src/               # Source code
│   └── package.json       # Frontend dependencies
├── server/                # Node.js backend
│   ├── src/               # Source code
│   └── package.json       # Backend dependencies
├── docker-compose.yml     # Production setup
├── docker-compose.dev.yml # Development setup with hot reloading
└── package.json           # Root package.json with dev scripts
```

## Quick Commands

```bash
# Start development environment
npm run dev:docker

# View logs
npm run dev:docker:logs

# Stop development environment
npm run dev:docker:down

# Rebuild and start
npm run dev:docker -- --build

# Run database migrations
npm run migrate

# Seed sample data
npm run seed
```

## Development Workflow

1. Start the development environment: `npm run dev:docker`
2. Make changes to any file in `client/src/` or `server/`
3. Changes will automatically reflect in the browser/API
4. Check logs if something isn't working: `npm run dev:docker:logs`
5. Stop when done: `npm run dev:docker:down`

