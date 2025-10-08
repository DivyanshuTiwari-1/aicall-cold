@echo off
echo ========================================
echo AI Dialer - Environment Setup
echo ========================================
echo.

cd server

if exist .env (
    echo .env file already exists!
    echo Do you want to overwrite it? Press Ctrl+C to cancel, or
    pause
)

echo Creating .env file for TELNYX (Self-Hosted) setup...
echo.

(
echo # Server Configuration
echo NODE_ENV=development
echo PORT=3000
echo.
echo # Database Configuration
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_NAME=ai_dialer
echo DB_USER=admin@example.com
echo DB_PASSWORD=admin
echo.
echo # Redis Configuration
echo REDIS_HOST=localhost
echo REDIS_PORT=6379
echo.
echo # JWT Configuration
echo JWT_SECRET=ai_dialer_secret_key_change_in_production_12345
echo JWT_EXPIRES_IN=24h
echo.
echo # Voice Stack - Using SELF_HOSTED with Telnyx for $0.0045/5min
echo VOICE_STACK=self_hosted
echo.
echo # Asterisk ARI Configuration
echo ARI_URL=http://localhost:8088/ari
echo ARI_USER=ari_user
echo ARI_PASS=ari_password
echo.
echo # Telnyx SIP Credentials ^(from asterisk/pjsip.conf^)
echo TELNYX_SIP_USERNAME=info@pitchnhire.com
echo TELNYX_SIP_PASSWORD=DxZU$m4#GuFhRTp
echo TELNYX_DID=+12025550123
echo TELNYX_API_KEY=your_telnyx_api_key_from_portal
echo.
echo # Self-hosted AI Service URLs ^(for cost optimization^)
echo ASR_URL=http://localhost:5001/transcribe
echo LLM_URL=http://localhost:5002/generate
echo TTS_URL=http://localhost:5003/synthesize
echo.
echo # Optional: Cloud AI Services ^(NOT RECOMMENDED - increases cost^)
echo OPENAI_API_KEY=
echo ELEVENLABS_API_KEY=
echo.
echo # Twilio ^(NOT USED - we use Telnyx^)
echo TWILIO_ACCOUNT_SID=
echo TWILIO_AUTH_TOKEN=
echo TWILIO_PHONE_NUMBER=
echo.
echo # Webhook Base URL
echo WEBHOOK_BASE_URL=http://localhost:3000
) > .env

echo.
echo ========================================
echo .env file created successfully!
echo ========================================
echo.
echo Configuration: SELF_HOSTED with Telnyx
echo Target Cost: $0.0045 per 5 minutes
echo.
echo IMPORTANT: Update if needed:
echo   1. TELNYX_API_KEY - Get from https://portal.telnyx.com
echo   2. DB_PASSWORD - Your PostgreSQL password
echo   3. ASR/LLM/TTS URLs - Your self-hosted AI services
echo.
pause
