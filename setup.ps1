Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AI Dialer Pro - Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nStep 1: Installing dependencies..." -ForegroundColor Yellow
try {
    npm run install:all
    Write-Host "Dependencies installed successfully!" -ForegroundColor Green
} catch {
    Write-Host "Error installing dependencies!" -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "`nStep 2: Setting up environment..." -ForegroundColor Yellow
if (!(Test-Path "server\.env")) {
    Copy-Item "server\env.example" "server\.env"
    Write-Host "Created .env file from template" -ForegroundColor Green
    Write-Host "Please edit server\.env with your database credentials" -ForegroundColor Yellow
} else {
    Write-Host ".env file already exists" -ForegroundColor Green
}

Write-Host "`nStep 3: Database setup options:" -ForegroundColor Yellow
Write-Host "`nOption A - Use Docker (Recommended):" -ForegroundColor Cyan
Write-Host "  docker-compose up -d postgres redis" -ForegroundColor White
Write-Host "  npm run migrate" -ForegroundColor White
Write-Host "  npm run seed" -ForegroundColor White

Write-Host "`nOption B - Manual PostgreSQL:" -ForegroundColor Cyan
Write-Host "  1. Install PostgreSQL from https://www.postgresql.org/download/windows/" -ForegroundColor White
Write-Host "  2. Create database: createdb ai_dialer" -ForegroundColor White
Write-Host "  3. Update server\.env with your PostgreSQL password" -ForegroundColor White
Write-Host "  4. Run: npm run migrate" -ForegroundColor White

Write-Host "`nOption C - Full Docker setup:" -ForegroundColor Cyan
Write-Host "  docker-compose up -d" -ForegroundColor White

Write-Host "`nStep 4: Starting the application..." -ForegroundColor Yellow
Write-Host "Run one of these commands:" -ForegroundColor White
Write-Host "  npm run dev          (for development)" -ForegroundColor White
Write-Host "  docker-compose up -d (for full Docker setup)" -ForegroundColor White

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Setup complete! Check setup-database.md for detailed instructions." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Read-Host "Press Enter to continue"
