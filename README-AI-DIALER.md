# AI Dialer System with Asterisk and Telnyx Integration

A comprehensive AI-powered cold calling system that uses Asterisk PBX, advanced Text-to-Speech (TTS) services, and Telnyx telephony integration for automated outbound calling campaigns.

## 🚀 Features

### Core Functionality
- **AI-Powered Conversations**: Intelligent call handling with natural conversation flow
- **Advanced TTS Integration**: Support for Google Cloud TTS, Azure Cognitive Services, and AWS Polly
- **Real-time Call Management**: Live call monitoring and control via Asterisk ARI
- **Campaign Management**: Create and manage multiple calling campaigns
- **Contact Management**: Organize and segment contact lists
- **Script Management**: Dynamic script execution with variable substitution
- **Call Analytics**: Comprehensive reporting and analytics dashboard

### Telephony Features
- **Telnyx Integration**: Professional SIP trunking for reliable call delivery
- **Call Recording**: Automatic recording of all conversations
- **Voicemail Handling**: Intelligent voicemail detection and recording
- **Transfer Capabilities**: Seamless transfer to human agents
- **DTMF Processing**: Touch-tone response handling
- **Call Quality Monitoring**: Real-time call quality assessment

### AI & TTS Features
- **Multiple TTS Providers**: Google, Azure, AWS Polly support
- **Human-like Voices**: High-quality neural voice synthesis
- **Dynamic Script Processing**: Real-time script variable replacement
- **Conversation State Management**: Intelligent conversation flow control
- **Response Analysis**: Basic sentiment and intent analysis
- **Voice Cloning**: Support for custom voice models (future feature)

## 📋 Prerequisites

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+), Windows 10+, or macOS
- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Storage**: 10GB+ available disk space
- **Network**: Stable internet connection for TTS services

### Software Dependencies
- **Node.js**: v16.0.0 or higher
- **npm**: v8.0.0 or higher
- **Asterisk**: v18.0.0 or higher
- **PostgreSQL**: v12.0 or higher
- **Redis**: v6.0 or higher
- **espeak**: For fallback TTS

### External Services
- **Telnyx Account**: For SIP trunking and phone numbers
- **Google Cloud TTS API**: For high-quality voice synthesis (recommended)
- **Database**: PostgreSQL for data storage
- **Cache**: Redis for session management

## 🛠️ Installation

### Quick Setup (Linux)

```bash
# Clone the repository
git clone <repository-url>
cd aicall

# Make setup script executable
chmod +x setup-ai-dialer.sh

# Run the setup script
./setup-ai-dialer.sh
```

### Windows Setup

```cmd
# Clone the repository
git clone <repository-url>
cd aicall

# Run the Windows setup script
setup-ai-dialer.bat
```

### Manual Setup

1. **Install Dependencies**
   ```bash
   # Server dependencies
   cd server
   npm install

   # Client dependencies
   cd ../client
   npm install
   ```

2. **Configure Environment**
   ```bash
   # Copy environment template
   cp .env.example .env

   # Edit configuration
   nano .env
   ```

3. **Setup Database**
   ```bash
   # Run migrations
   cd server
   npm run migrate
   npm run seed
   ```

4. **Configure Asterisk**
   ```bash
   # Copy configuration files
   sudo cp server/asterisk/*.conf /etc/asterisk/
   sudo cp server/asterisk/*.php /var/lib/asterisk/agi-bin/

   # Restart Asterisk
   sudo systemctl restart asterisk
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_dialer
DB_USER=ai_dialer
DB_PASSWORD=your_password_here

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# API Configuration
API_URL=http://localhost:3000/api/v1
API_TOKEN=your_api_token_here
PORT=3000

# Asterisk ARI Configuration
ARI_URL=http://localhost:8088/ari
ARI_USERNAME=ai-dialer
ARI_PASSWORD=ai-dialer-password

# TTS Configuration
TTS_ENGINE=google
TTS_LANGUAGE=en-US
TTS_VOICE=en-US-Wavenet-D
GOOGLE_TTS_API_KEY=your_google_tts_api_key_here

# Telnyx Configuration
TELNYX_API_KEY=your_telnyx_api_key_here
TELNYX_USERNAME=your_telnyx_username
TELNYX_PASSWORD=your_telnyx_password
TELNYX_DOMAIN=your_telnyx_domain
TELNYX_SIP_URI=your_telnyx_sip_uri
TELNYX_IP_RANGE=your_telnyx_ip_range
TELNYX_CALLER_ID=your_caller_id
```

### Telnyx Setup

1. **Create Telnyx Account**
   - Sign up at [telnyx.com](https://telnyx.com)
   - Purchase phone numbers
   - Configure SIP trunk

2. **Configure SIP Settings**
   - Get your SIP credentials from Telnyx dashboard
   - Update `pjsip.conf` with your credentials
   - Configure firewall for SIP traffic (ports 5060, 10000-20000)

3. **Test Connection**
   ```bash
   # Test SIP connectivity
   asterisk -rx "sip show peers"
   ```

### TTS Provider Setup

#### Google Cloud TTS (Recommended)
1. Create a Google Cloud project
2. Enable the Text-to-Speech API
3. Create a service account and download the JSON key
4. Set `GOOGLE_TTS_API_KEY` in your `.env` file

#### Azure Cognitive Services
1. Create an Azure Cognitive Services resource
2. Get your API key and region
3. Set `AZURE_TTS_API_KEY` and `AZURE_TTS_REGION` in your `.env` file

#### AWS Polly
1. Create an AWS account
2. Set up IAM user with Polly permissions
3. Set AWS credentials in your `.env` file

## 🚀 Usage

### Starting the System

```bash
# Start the main server
cd server
npm start

# Start the ARI application (in another terminal)
cd server/asterisk
node ai-dialer-app.js

# Start the web client (in another terminal)
cd client
npm start
```

### Web Interface

Access the web interface at `http://localhost:3000`

- **Dashboard**: Overview of campaigns and call statistics
- **Campaigns**: Create and manage calling campaigns
- **Contacts**: Manage contact lists and segments
- **Calls**: View call history and recordings
- **Analytics**: Detailed reporting and insights
- **Settings**: System configuration and preferences

### API Usage

The system provides a RESTful API for integration:

```bash
# Create a campaign
curl -X POST http://localhost:3000/api/v1/campaigns \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "description": "My first campaign",
    "max_calls_per_hour": 10
  }'

# Initiate a call
curl -X POST http://localhost:3000/api/v1/calls/initiate \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "contact_phone": "+1234567890",
    "campaign_id": "campaign_id_here"
  }'
```

## 📊 Testing

### Run Test Suite

```bash
# Run comprehensive tests
node test-telnyx-cold-calls.js

# Run specific test categories
node test-telnyx-cold-calls.js --test=api
node test-telnyx-cold-calls.js --test=tts
node test-telnyx-cold-calls.js --test=calls
```

### Test Real Calls

```bash
# Enable real call testing
export ENABLE_REAL_CALLS=true
node test-telnyx-cold-calls.js
```

## 🔧 Troubleshooting

### Common Issues

#### Asterisk Not Starting
```bash
# Check Asterisk status
sudo systemctl status asterisk

# View Asterisk logs
sudo journalctl -u asterisk -f

# Check configuration syntax
asterisk -T -x "dialplan show ai-dialer"
```

#### TTS Not Working
```bash
# Test TTS service
curl -X POST http://localhost:3000/api/v1/tts/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voice": "en-US-Wavenet-D"}'

# Check TTS logs
tail -f server/logs/app.log
```

#### Call Quality Issues
- Check network connectivity
- Verify Telnyx SIP configuration
- Monitor Asterisk logs for RTP issues
- Test with different codecs (ulaw, alaw, g722)

### Log Files

- **Application Logs**: `server/logs/app.log`
- **Error Logs**: `server/logs/error.log`
- **Asterisk Logs**: `/var/log/asterisk/full`
- **Call Logs**: `/var/log/asterisk/ai-dialer-calls.log`

## 📈 Performance Optimization

### System Tuning

1. **Asterisk Configuration**
   ```ini
   # Increase RTP timeout
   rtpstart=10000
   rtpend=20000

   # Optimize for voice
   maxload=0.9
   maxfiles=1000
   ```

2. **Database Optimization**
   ```sql
   -- Add indexes for better performance
   CREATE INDEX idx_calls_campaign_id ON calls(campaign_id);
   CREATE INDEX idx_calls_status ON calls(status);
   CREATE INDEX idx_calls_created_at ON calls(created_at);
   ```

3. **TTS Caching**
   - Enable TTS caching for frequently used phrases
   - Use Redis for TTS audio caching
   - Implement audio file cleanup

### Scaling Considerations

- **Horizontal Scaling**: Run multiple Asterisk instances
- **Load Balancing**: Use HAProxy or similar for call distribution
- **Database Scaling**: Implement read replicas for analytics
- **TTS Scaling**: Use multiple TTS providers for redundancy

## 🔒 Security

### Best Practices

1. **Network Security**
   - Use VPN for remote access
   - Implement firewall rules
   - Enable SIP authentication

2. **Data Protection**
   - Encrypt sensitive data at rest
   - Use HTTPS for web interface
   - Implement proper access controls

3. **Compliance**
   - Follow TCPA regulations
   - Implement DNC (Do Not Call) lists
   - Maintain call logs for compliance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact support at support@example.com

## 🗺️ Roadmap

### Upcoming Features
- [ ] Voice cloning and custom voice models
- [ ] Advanced AI conversation management
- [ ] Multi-language support
- [ ] Integration with CRM systems
- [ ] Advanced analytics and reporting
- [ ] Mobile app for monitoring
- [ ] WebRTC support for browser-based calling

### Version History
- **v1.0.0**: Initial release with basic functionality
- **v1.1.0**: Added multiple TTS providers
- **v1.2.0**: Enhanced conversation flow management
- **v1.3.0**: Telnyx integration and real call testing

---

**Happy Calling! 🎉**

For more information, visit our [documentation site](https://docs.example.com) or join our [community forum](https://community.example.com).
