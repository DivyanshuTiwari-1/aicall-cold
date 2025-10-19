@echo off
REM AI Dialer AGI Scripts Installation Script for Docker on Windows
REM This script sets up the AGI scripts for Asterisk integration in Docker

echo Installing AI Dialer AGI Scripts in Docker...

REM Check if Asterisk container is running
docker ps | findstr "asterisk" >nul
if %errorlevel% neq 0 (
    echo Error: Asterisk container is not running!
    echo Please start the Asterisk container first with: docker-compose up -d asterisk
    pause
    exit /b 1
)

echo Asterisk container is running. Proceeding with installation...

REM Create AGI directory in container
echo Creating AGI directory in Asterisk container...
docker exec asterisk mkdir -p /var/lib/asterisk/agi-bin

REM Copy AGI scripts to container
echo Copying AGI scripts to Asterisk container...
docker cp ai-dialer-agi.php asterisk:/var/lib/asterisk/agi-bin/
if %errorlevel% equ 0 (
    echo [SUCCESS] ai-dialer-agi.php copied
) else (
    echo [ERROR] Failed to copy ai-dialer-agi.php
)

docker cp ai-dialer-hangup-agi.php asterisk:/var/lib/asterisk/agi-bin/
if %errorlevel% equ 0 (
    echo [SUCCESS] ai-dialer-hangup-agi.php copied
) else (
    echo [ERROR] Failed to copy ai-dialer-hangup-agi.php
)

docker cp ai-inbound-agi.php asterisk:/var/lib/asterisk/agi-bin/
if %errorlevel% equ 0 (
    echo [SUCCESS] ai-inbound-agi.php copied
) else (
    echo [ERROR] Failed to copy ai-inbound-agi.php
)

REM Make scripts executable
echo Setting executable permissions...
docker exec asterisk chmod +x /var/lib/asterisk/agi-bin/ai-*.php
if %errorlevel% equ 0 (
    echo [SUCCESS] Scripts made executable
) else (
    echo [ERROR] Failed to set executable permissions
)

REM Create temporary directories
echo Creating temporary directories...
docker exec asterisk mkdir -p /tmp/audio-uploads
docker exec asterisk mkdir -p /tmp/tts
echo [SUCCESS] Temporary directories created

REM Install PHP if not available
echo Checking PHP installation...
docker exec asterisk php --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing PHP in Asterisk container...
    docker exec asterisk apt-get update
    docker exec asterisk apt-get install -y php-cli php-curl
    if %errorlevel% equ 0 (
        echo [SUCCESS] PHP installed
    ) else (
        echo [ERROR] Failed to install PHP
    )
) else (
    echo [SUCCESS] PHP is already installed
)

REM Test AGI scripts
echo Testing AGI scripts installation...
docker exec asterisk test -f /var/lib/asterisk/agi-bin/ai-dialer-agi.php
if %errorlevel% equ 0 (
    echo [SUCCESS] ai-dialer-agi.php installed successfully
) else (
    echo [ERROR] Failed to install ai-dialer-agi.php
)

docker exec asterisk test -f /var/lib/asterisk/agi-bin/ai-dialer-hangup-agi.php
if %errorlevel% equ 0 (
    echo [SUCCESS] ai-dialer-hangup-agi.php installed successfully
) else (
    echo [ERROR] Failed to install ai-dialer-hangup-agi.php
)

docker exec asterisk test -f /var/lib/asterisk/agi-bin/ai-inbound-agi.php
if %errorlevel% equ 0 (
    echo [SUCCESS] ai-inbound-agi.php installed successfully
) else (
    echo [ERROR] Failed to install ai-inbound-agi.php
)

REM Test PHP execution
echo Testing PHP execution...
docker exec asterisk php -v >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] PHP is working correctly
) else (
    echo [ERROR] PHP is not working correctly
)

echo.
echo AGI Scripts Installation Complete!
echo.
echo Next steps:
echo 1. Restart Asterisk container: docker-compose restart asterisk
echo 2. Check Asterisk logs: docker logs asterisk
echo 3. Test the AI dialer by starting a call from the web interface
echo.
echo Configuration:
echo - AGI scripts location: /var/lib/asterisk/agi-bin
echo - API URL: http://ai_dialer:3000/api/v1
echo - Temp directories: /tmp/audio-uploads, /tmp/tts
echo.
pause
