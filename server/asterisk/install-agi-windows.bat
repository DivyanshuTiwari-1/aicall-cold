@echo off
REM AI Dialer AGI Scripts Installation Script for Windows
REM This script sets up the AGI scripts for Asterisk integration on Windows

echo Installing AI Dialer AGI Scripts for Windows...

REM Set the directory where AGI scripts should be located
REM Adjust this path based on your Asterisk installation
set AGI_DIR=C:\Program Files\Asterisk\agi-bin
set SCRIPT_DIR=%~dp0

REM Check if Asterisk AGI directory exists
if not exist "%AGI_DIR%" (
    echo Creating AGI directory: %AGI_DIR%
    mkdir "%AGI_DIR%"
)

REM Copy AGI scripts to Asterisk AGI directory
echo Copying AGI scripts to %AGI_DIR%...
copy "%SCRIPT_DIR%ai-dialer-agi.php" "%AGI_DIR%\"
copy "%SCRIPT_DIR%ai-dialer-hangup-agi.php" "%AGI_DIR%\"
copy "%SCRIPT_DIR%ai-inbound-agi.php" "%AGI_DIR%\"

REM Create temporary directories
echo Creating temporary directories...
if not exist "C:\tmp\audio-uploads" mkdir "C:\tmp\audio-uploads"
if not exist "C:\tmp\tts" mkdir "C:\tmp\tts"

REM Test if files were copied successfully
echo Testing AGI scripts installation...
if exist "%AGI_DIR%\ai-dialer-agi.php" (
    echo [SUCCESS] ai-dialer-agi.php installed
) else (
    echo [ERROR] Failed to install ai-dialer-agi.php
)

if exist "%AGI_DIR%\ai-dialer-hangup-agi.php" (
    echo [SUCCESS] ai-dialer-hangup-agi.php installed
) else (
    echo [ERROR] Failed to install ai-dialer-hangup-agi.php
)

if exist "%AGI_DIR%\ai-inbound-agi.php" (
    echo [SUCCESS] ai-inbound-agi.php installed
) else (
    echo [ERROR] Failed to install ai-inbound-agi.php
)

echo.
echo AGI Scripts Installation Complete!
echo.
echo Next steps:
echo 1. Install PHP if not already installed
echo 2. Configure Asterisk to use these AGI scripts
echo 3. Update your Asterisk extensions.conf to reference the scripts
echo 4. Restart Asterisk service
echo.
echo Configuration:
echo - AGI scripts location: %AGI_DIR%
echo - API URL: http://localhost:3000/api/v1
echo - Temp directories: C:\tmp\audio-uploads, C:\tmp\tts
echo.
pause
