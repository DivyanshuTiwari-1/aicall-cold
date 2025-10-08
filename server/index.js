const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const contactRoutes = require('./routes/contacts');
const callRoutes = require('./routes/calls');
const analyticsRoutes = require('./routes/analytics');
const dncRoutes = require('./routes/dnc');
const knowledgeRoutes = require('./routes/knowledge');
const mlRoutes = require('./routes/ml');
const scriptRoutes = require('./routes/scripts');
const conversationRoutes = require('./routes/conversation');
// Initialize telephony provider early
require('./services/telephony');

const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { createTables } = require('./scripts/migrate');
const logger = require('./utils/logger');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const server = createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server });

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? ['https://yourdomain.com'] : ['http://localhost:3001'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/campaigns', authenticateToken, campaignRoutes);
app.use('/api/v1/contacts', authenticateToken, contactRoutes);
app.use('/api/v1/calls', authenticateToken, callRoutes);
app.use('/api/v1/analytics', authenticateToken, analyticsRoutes);
app.use('/api/v1/dnc', authenticateToken, dncRoutes);
app.use('/api/v1/knowledge', authenticateToken, knowledgeRoutes);
app.use('/api/v1/ml', authenticateToken, mlRoutes);
app.use('/api/v1/scripts', authenticateToken, scriptRoutes);
app.use('/api/v1/conversation', authenticateToken, conversationRoutes);

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    logger.info('New WebSocket connection established');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'subscribe_call') {
                ws.callId = data.call_id;
                logger.info(`Client subscribed to call: ${data.call_id}`);
            }
        } catch (error) {
            logger.error('WebSocket message parsing error:', error);
        }
    });

    ws.on('close', () => {
        logger.info('WebSocket connection closed');
    });
});

// Global WebSocket broadcast function
global.broadcastToCall = (callId, data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === 1 && client.callId === callId) {
            client.send(JSON.stringify(data));
        }
    });
};

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Initialize database and start server
async function startServer() {
    try {
        await connectDB();
        await connectRedis();
        await createTables();

        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            logger.info(`🚀 AI Dialer API Server running on port ${PORT}`);
            logger.info(`📊 Health check: http://localhost:${PORT}/health`);
            logger.info(`🔌 WebSocket server ready for real-time connections`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = { app, server, wss };