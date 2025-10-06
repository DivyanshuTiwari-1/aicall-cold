# Self-Hosted Voice Stack Guide

This guide configures a minimal-cost stack to run AI calls on your own infra.

Components
- Asterisk (SIP + ARI) for telephony and call control
- faster-whisper (small, int8) for streaming ASR
- Local LLM server (7B quantized via llama.cpp) for dialogue
- Coqui XTTS for TTS with streaming

Prerequisites
- Docker Desktop installed and running
- A SIP trunk (e.g., Telnyx, AnveoDirect) and SIP credentials

1) Start core services
```bash
docker-compose -f docker-compose.dev.yml up -d   # Postgres, Redis, pgAdmin, Redis Commander
docker-compose -f docker-compose.selfhost.yml up -d   # Asterisk, ASR, LLM, TTS
```

2) Configure Asterisk
- Map your SIP credentials into the container (pjsip.conf, extensions.conf)
- Enable ARI in `http.conf` and `ari.conf`, app name `ai-dialer`
- Point outbound calls to your SIP trunk

3) Backend configuration
Create `server/.env` with:
```
VOICE_STACK=self_hosted
ARI_URL=http://localhost:8088
ARI_USER=ari_user
ARI_PASS=ari_password
ASR_URL=http://localhost:8001
LLM_URL=http://localhost:8002
TTS_URL=http://localhost:8003
```

4) Run migrations and start API/frontend
```bash
npm run install:all
npm run migrate
npm run seed
npm run dev
```

5) Place a test call
- Create a campaign and contact in the UI
- Start a call from the UI → the API will call `telephony.startOutboundCall`

Notes
- You must supply an Asterisk image configured with SIP and ARI. The provided example image is a placeholder; for production, use a maintained Asterisk Dockerfile and mount configs.
- For lowest cost, use PCMU or Opus and keep LLM outputs concise.
- For multilingual, switch Whisper model to `small` (non-en) and ensure CPU/GPU sizing.

