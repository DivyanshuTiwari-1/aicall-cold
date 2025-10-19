# AI Dialer AGI Scripts Installation Script for Windows PowerShell
# This script sets up the AGI scripts for Asterisk integration on Windows

Write-Host "Installing AI Dialer AGI Scripts for Windows..." -ForegroundColor Green

# Set the directory where AGI scripts should be located
# Adjust this path based on your Asterisk installation
$AGI_DIR = "C:\Program Files\Asterisk\agi-bin"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "Warning: Not running as administrator. Some operations may fail." -ForegroundColor Yellow
    Write-Host "Consider running PowerShell as Administrator for full installation." -ForegroundColor Yellow
}

# Check if Asterisk AGI directory exists
if (-not (Test-Path $AGI_DIR)) {
    Write-Host "Creating AGI directory: $AGI_DIR" -ForegroundColor Yellow
    try {
        New-Item -ItemType Directory -Path $AGI_DIR -Force | Out-Null
        Write-Host "AGI directory created successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to create AGI directory: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Copy AGI scripts to Asterisk AGI directory
Write-Host "Copying AGI scripts to $AGI_DIR..." -ForegroundColor Yellow

$scripts = @(
    "ai-dialer-agi.php",
    "ai-dialer-hangup-agi.php",
    "ai-inbound-agi.php"
)

foreach ($script in $scripts) {
    $sourcePath = Join-Path $SCRIPT_DIR $script
    $destPath = Join-Path $AGI_DIR $script

    if (Test-Path $sourcePath) {
        try {
            Copy-Item $sourcePath $destPath -Force
            Write-Host "[SUCCESS] $script installed" -ForegroundColor Green
        }
        catch {
            Write-Host "[ERROR] Failed to install $script : $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    else {
        Write-Host "[ERROR] Source file not found: $sourcePath" -ForegroundColor Red
    }
}

# Create temporary directories
Write-Host "Creating temporary directories..." -ForegroundColor Yellow

$tempDirs = @(
    "C:\tmp\audio-uploads",
    "C:\tmp\tts"
)

foreach ($dir in $tempDirs) {
    if (-not (Test-Path $dir)) {
        try {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "Created directory: $dir" -ForegroundColor Green
        }
        catch {
            Write-Host "Failed to create directory $dir : $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    else {
        Write-Host "Directory already exists: $dir" -ForegroundColor Yellow
    }
}

# Check PHP installation
Write-Host "Checking PHP installation..." -ForegroundColor Yellow
try {
    $phpVersion = php -v 2>$null
    if ($phpVersion) {
        Write-Host "PHP is installed: $($phpVersion[0])" -ForegroundColor Green
    }
    else {
        Write-Host "PHP not found. Please install PHP to use AGI scripts." -ForegroundColor Red
    }
}
catch {
    Write-Host "PHP not found. Please install PHP to use AGI scripts." -ForegroundColor Red
}

# Test AGI scripts
Write-Host "`nTesting AGI scripts installation..." -ForegroundColor Yellow

foreach ($script in $scripts) {
    $scriptPath = Join-Path $AGI_DIR $script
    if (Test-Path $scriptPath) {
        Write-Host "[SUCCESS] $script installed successfully" -ForegroundColor Green
    }
    else {
        Write-Host "[ERROR] Failed to install $script" -ForegroundColor Red
    }
}

Write-Host "`nAGI Scripts Installation Complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Install PHP if not already installed" -ForegroundColor White
Write-Host "2. Configure Asterisk to use these AGI scripts" -ForegroundColor White
Write-Host "3. Update your Asterisk extensions.conf to reference the scripts" -ForegroundColor White
Write-Host "4. Restart Asterisk service" -ForegroundColor White
Write-Host "`nConfiguration:" -ForegroundColor Cyan
Write-Host "- AGI scripts location: $AGI_DIR" -ForegroundColor White
Write-Host "- API URL: http://localhost:3000/api/v1" -ForegroundColor White
Write-Host "- Temp directories: C:\tmp\audio-uploads, C:\tmp\tts" -ForegroundColor White

Read-Host "`nPress Enter to continue"
