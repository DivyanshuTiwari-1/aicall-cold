const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const contactRoutes = require('./routes/contacts');
const callRoutes = require('./routes/calls');
const analyticsRoutes = require('./routes/analytics');
const dncRoutes = require('./routes/dnc');
const complianceRoutes = require('./routes/compliance');
const costOptimizationRoutes = require('./routes/cost-optimization');
const knowledgeRoutes = require('./routes/knowledge');
const mlRoutes = require('./routes/ml');
const scriptRoutes = require('./routes/scripts');
const conversationRoutes = require('./routes/conversation');
const asteriskRoutes = require('./routes/asterisk');
const userRoutes = require('./routes/users');
const assignmentRoutes = require('./routes/assignments');
const manualCallRoutes = require('./routes/manualcalls');
const aiIntelligenceRoutes = require('./routes/ai-intelligence');
const billingRoutes = require('./routes/billing');
const warmTransferRoutes = require('./routes/warm-transfers');
const webhookRoutes = require('./routes/webhooks');
const simpleCallRoutes = require('./routes/simple-calls');
const phoneNumberRoutes = require('./routes/phone-numbers');
// Initialize telephony provider early
require('./services/telephony');

const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { createTables } = require('./scripts/migrate');
const logger = require('./utils/logger');
const { authenticateToken } = require('./middleware/auth');
const stasisManager = require('./services/stasis-apps');
const addSipFields = require('./scripts/migrations/add-sip-fields');
const addTranscriptField = require('./scripts/migrations/add-transcript-field');

const app = express();
const server = createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server });

// Middleware
app.use(helmet());
// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN ?
    process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : ['http://localhost:3001', 'http://localhost:3000'];

app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? corsOrigins : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting - configurable via environment variables
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests default
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip rate limiting for health checks and certain endpoints
    skip: (req) => {
        return req.path === '/health' || req.path === '/api/health';
    }
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
app.use('/api/v1/users', authenticateToken, userRoutes);
app.use('/api/v1/assignments', authenticateToken, assignmentRoutes);
app.use('/api/v1/manualcalls', authenticateToken, manualCallRoutes);
app.use('/api/v1/ai-intelligence', authenticateToken, aiIntelligenceRoutes);
app.use('/api/v1/billing', authenticateToken, billingRoutes);
app.use('/api/v1/warm-transfers', authenticateToken, warmTransferRoutes);
app.use('/api/v1/webhooks', authenticateToken, webhookRoutes);
app.use('/api/v1/simple-calls', authenticateToken, simpleCallRoutes);
app.use('/api/v1/phone-numbers', authenticateToken, phoneNumberRoutes);
app.use('/api/v1/campaigns', authenticateToken, campaignRoutes);
app.use('/api/v1/contacts', authenticateToken, contactRoutes);
app.use('/api/v1/calls', authenticateToken, callRoutes);
app.use('/api/v1/analytics', authenticateToken, analyticsRoutes);
app.use('/api/v1/dnc', authenticateToken, dncRoutes);
app.use('/api/v1/compliance', authenticateToken, complianceRoutes);
app.use('/api/v1/cost-optimization', authenticateToken, costOptimizationRoutes);
app.use('/api/v1/knowledge', authenticateToken, knowledgeRoutes);
app.use('/api/v1/ml', authenticateToken, mlRoutes);
app.use('/api/v1/scripts', authenticateToken, scriptRoutes);
app.use('/api/v1/conversation', authenticateToken, conversationRoutes);
app.use('/api/v1/asterisk', asteriskRoutes); // No auth required for AGI scripts

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    logger.info('New WebSocket connection established');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'subscribe_call':
                    ws.callId = data.call_id;
                    logger.info(`Client subscribed to call: ${data.call_id}`);
                    break;

                case 'subscribe_user':
                    ws.userId = data.user_id;
                    ws.organizationId = data.organization_id;
                    logger.info(`Client subscribed to user: ${data.user_id}`);
                    break;

                case 'subscribe_agent':
                    ws.agentId = data.agent_id;
                    ws.organizationId = data.organization_id;
                    logger.info(`Client subscribed to agent: ${data.agent_id}`);
                    break;

                case 'subscribe_organization':
                    ws.organizationId = data.organization_id;
                    logger.info(`Client subscribed to organization: ${data.organization_id}`);
                    break;

                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;

                default:
                    logger.warn(`Unknown WebSocket message type: ${data.type}`);
            }
        } catch (error) {
            logger.error('WebSocket message parsing error:', error);
        }
    });

    ws.on('close', () => {
        logger.info('WebSocket connection closed');
    });
});

// Global WebSocket broadcast functions
global.broadcastToCall = (callId, data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === 1 && client.callId === callId) {
            client.send(JSON.stringify(data));
        }
    });
};

global.broadcastToUser = (userId, data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === 1 && client.userId === userId) {
            client.send(JSON.stringify(data));
        }
    });
};

global.broadcastToAgent = (agentId, data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === 1 && client.agentId === agentId) {
            client.send(JSON.stringify(data));
        }
    });
};

global.broadcastToOrganization = (organizationId, data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === 1 && client.organizationId === organizationId) {
            client.send(JSON.stringify(data));
        }
    });
};

// Phase 1 specific broadcast functions
global.broadcastCallStatusUpdate = (callId, status, metadata = {}) => {
    global.broadcastToCall(callId, {
        type: 'call_status_update',
        callId,
        status,
        metadata,
        timestamp: new Date().toISOString()
    });
};

global.broadcastNewLeadAssignment = (agentId, assignment) => {
    global.broadcastToAgent(agentId, {
        type: 'new_lead_assigned',
        assignment,
        timestamp: new Date().toISOString()
    });
};

global.broadcastAnalysisComplete = (callId, analysis) => {
    global.broadcastToCall(callId, {
        type: 'analysis_complete',
        callId,
        analysis,
        timestamp: new Date().toISOString()
    });
};

global.broadcastAgentStatusChange = (agentId, status, metadata = {}) => {
    global.broadcastToAgent(agentId, {
        type: 'agent_status_change',
        agentId,
        status,
        metadata,
        timestamp: new Date().toISOString()
    });
};

global.broadcastWarmTransferRequest = (agentId, transferData) => {
    global.broadcastToAgent(agentId, {
        type: 'warm_transfer_request',
        transferData,
        timestamp: new Date().toISOString()
    });
};

global.broadcastCreditUpdate = (organizationId, creditData) => {
    global.broadcastToOrganization(organizationId, {
        type: 'credit_update',
        creditData,
        timestamp: new Date().toISOString()
    });
};

global.broadcastTeamPerformanceUpdate = (organizationId, performanceData) => {
    global.broadcastToOrganization(organizationId, {
        type: 'team_performance_update',
        performanceData,
        timestamp: new Date().toISOString()
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
        // Create necessary directories
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            logger.info('📁 Created uploads directory');
        }

        await connectDB();
        await connectRedis();
        await createTables();

        // Run migrations
        await addSipFields();
        await addTranscriptField();

        // Initialize Stasis applications
        await stasisManager.initialize();

        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            logger.info(`🚀 AI Dialer API Server running on port ${PORT}`);
            logger.info(`📊 Health check: http://localhost:${PORT}/health`);
            logger.info(`🔌 WebSocket server ready for real-time connections`);
            logger.info(`☎️  Stasis applications initialized for call handling`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('🔄 Received SIGINT, shutting down gracefully...');
    await stasisManager.shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('🔄 Received SIGTERM, shutting down gracefully...');
    await stasisManager.shutdown();
    process.exit(0);
});

startServer();

module.exports = { app, server, wss };
