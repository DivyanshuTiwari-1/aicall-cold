@echo off
REM Quick AGI Installation for Docker Asterisk
echo Quick AGI Installation for Docker Asterisk...

REM Check if we're in the right directory
if not exist "ai-dialer-agi.php" (
    echo Error: Please run this script from the server/asterisk directory
    echo Current directory: %CD%
    pause
    exit /b 1
)

REM Check if Asterisk container is running
echo Checking if Asterisk container is running...
docker ps | findstr "asterisk" >nul
if %errorlevel% neq 0 (
    echo Error: Asterisk container is not running!
    echo Please start it with: docker-compose up -d asterisk
    pause
    exit /b 1
)

echo Asterisk container is running. Installing AGI scripts...

REM Create directory and copy scripts
echo Creating AGI directory...
docker exec asterisk mkdir -p /var/lib/asterisk/agi-bin

echo Copying AGI scripts...
docker cp ai-dialer-agi.php asterisk:/var/lib/asterisk/agi-bin/
docker cp ai-dialer-hangup-agi.php asterisk:/var/lib/asterisk/agi-bin/
docker cp ai-inbound-agi.php asterisk:/var/lib/asterisk/agi-bin/

echo Making scripts executable...
docker exec asterisk chmod +x /var/lib/asterisk/agi-bin/ai-*.php

echo Installing PHP...
docker exec asterisk apt-get update -y
docker exec asterisk apt-get install -y php-cli php-curl

echo Creating temp directories...
docker exec asterisk mkdir -p /tmp/audio-uploads
docker exec asterisk mkdir -p /tmp/tts

echo.
echo Installation complete!
echo.
echo To verify installation, run:
echo docker exec asterisk ls -la /var/lib/asterisk/agi-bin/
echo.
echo To restart Asterisk:
echo docker-compose restart asterisk
echo.
pause
