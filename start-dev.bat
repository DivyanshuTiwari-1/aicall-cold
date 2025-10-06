@echo off
echo ========================================
echo AI Dialer Pro - Development Setup
echo ========================================

echo.
echo Step 1: Starting database services...
docker-compose -f docker-compose.dev.yml up -d

echo.
echo Step 2: Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo.
echo Step 3: Installing dependencies...
call npm run install:all
if %errorlevel% neq 0 (
    echo Error installing dependencies!
    pause
    exit /b 1
)

echo.
echo Step 4: Setting up environment...
if not exist "server\.env" (
    copy "server\env.example" "server\.env"
    echo Created .env file from template
) else (
    echo .env file already exists
)

echo.
echo Step 5: Running database migrations...
call npm run migrate
if %errorlevel% neq 0 (
    echo Error running migrations!
    echo Make sure PostgreSQL is running
    pause
    exit /b 1
)

echo.
echo Step 6: Seeding sample data...
call npm run seed

echo.
echo Step 7: Starting the application...
echo.
echo ========================================
echo Services are starting up...
echo ========================================
echo Database: http://localhost:5050 (admin@example.com / admin)
echo Redis: http://localhost:8081
echo.
echo Starting backend and frontend...
echo ========================================

start "Backend API" cmd /k "cd server && npm run dev"
timeout /t 3 /nobreak >nul
start "Frontend" cmd /k "cd client && npm start"

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo.
echo Access points:
echo - Frontend: http://localhost:3001
echo - Backend: http://localhost:3000
echo - Database Admin: http://localhost:5050
echo - Redis Admin: http://localhost:8081
echo.
echo Default login: admin@demo.com / password123
echo.
pause

