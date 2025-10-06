@echo off
echo ========================================
echo AI Dialer Pro - Setup Script
echo ========================================

echo.
echo Step 1: Installing dependencies...
call npm run install:all
if %errorlevel% neq 0 (
    echo Error installing dependencies!
    pause
    exit /b 1
)

echo.
echo Step 2: Setting up environment...
if not exist "server\.env" (
    copy "server\env.example" "server\.env"
    echo Created .env file from template
    echo Please edit server\.env with your database credentials
) else (
    echo .env file already exists
)

echo.
echo Step 3: Database setup options:
echo.
echo Option A - Use Docker (Recommended):
echo   docker-compose up -d postgres redis
echo   npm run migrate
echo   npm run seed
echo.
echo Option B - Manual PostgreSQL:
echo   1. Install PostgreSQL from https://www.postgresql.org/download/windows/
echo   2. Create database: createdb ai_dialer
echo   3. Update server\.env with your PostgreSQL password
echo   4. Run: npm run migrate
echo.
echo Option C - Full Docker setup:
echo   docker-compose up -d
echo.

echo Step 4: Starting the application...
echo Run one of these commands:
echo   npm run dev          (for development)
echo   docker-compose up -d (for full Docker setup)
echo.

echo ========================================
echo Setup complete! Check setup-database.md for detailed instructions.
echo ========================================
pause
