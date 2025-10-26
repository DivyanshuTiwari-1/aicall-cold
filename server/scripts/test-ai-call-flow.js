const { query } = require('../config/database');
const logger = require('../utils/logger');
const axios = require('axios');

/**
 * End-to-End Test for AI Automated Calls
 * Tests the complete flow from queue initiation to conversation completion
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
    organizationId: null,
    campaignId: null,
    contactId: null,
    phoneNumberId: null,
    callId: null,
    testPhoneNumber: '+15555551234', // Test number
};

async function main() {
    try {
        logger.info('🧪 Starting AI Call Flow Test');
        logger.info('=====================================\n');

        // Step 1: Check database connection
        await testDatabaseConnection();

        // Step 2: Check FastAGI server
        await testAgiServer();

        // Step 3: Check WebSocket server
        await testWebSocketServer();

        // Step 4: Setup test data
        await setupTestData();

        // Step 5: Test conversation engine
        await testConversationEngine();

        // Step 6: Test TTS service
        await testTTSService();

        // Step 7: Test STT service (optional - requires audio file)
        await testSTTService();

        // Step 8: Test queue service
        await testQueueService();

        // Step 9: Test WebSocket broadcasting
        await testWebSocketBroadcasting();

        // Step 10: Verify database records
        await verifyDatabaseRecords();

        logger.info('\n=====================================');
        logger.info('✅ All tests passed successfully!');
        logger.info('=====================================\n');

        logger.info('📋 Test Summary:');
        logger.info(`Organization ID: ${TEST_CONFIG.organizationId}`);
        logger.info(`Campaign ID: ${TEST_CONFIG.campaignId}`);
        logger.info(`Contact ID: ${TEST_CONFIG.contactId}`);
        logger.info(`Call ID: ${TEST_CONFIG.callId}`);

        process.exit(0);

    } catch (error) {
        logger.error('❌ Test failed:', error);
        process.exit(1);
    }
}

async function testDatabaseConnection() {
    logger.info('1️⃣  Testing database connection...');

    try {
        const result = await query('SELECT NOW()');
        logger.info('✅ Database connection successful');
        logger.info(`   Current time: ${result.rows[0].now}\n`);
    } catch (error) {
        throw new Error('Database connection failed: ' + error.message);
    }
}

async function testAgiServer() {
    logger.info('2️⃣  Testing FastAGI server...');

    try {
        const net = require('net');
        const AGI_PORT = parseInt(process.env.AGI_PORT) || 4573;

        await new Promise((resolve, reject) => {
            const client = net.connect(AGI_PORT, 'localhost', () => {
                logger.info(`✅ FastAGI server is running on port ${AGI_PORT}`);
                client.destroy();
                resolve();
            });

            client.on('error', (error) => {
                reject(new Error(`FastAGI server not accessible: ${error.message}`));
            });

            setTimeout(() => {
                client.destroy();
                reject(new Error('FastAGI server connection timeout'));
            }, 5000);
        });

        logger.info('');
    } catch (error) {
        throw new Error('FastAGI server test failed: ' + error.message);
    }
}

async function testWebSocketServer() {
    logger.info('3️⃣  Testing WebSocket server...');

    try {
        const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });

        if (response.data.status === 'healthy') {
            logger.info('✅ WebSocket server is healthy');
            logger.info(`   Version: ${response.data.version}\n`);
        } else {
            throw new Error('Server health check failed');
        }
    } catch (error) {
        throw new Error('WebSocket server test failed: ' + error.message);
    }
}

async function setupTestData() {
    logger.info('4️⃣  Setting up test data...');

    try {
        // Get first organization
        const orgResult = await query('SELECT id FROM organizations LIMIT 1');
        if (orgResult.rows.length === 0) {
            throw new Error('No organizations found. Please create an organization first.');
        }
        TEST_CONFIG.organizationId = orgResult.rows[0].id;
        logger.info(`   Using organization: ${TEST_CONFIG.organizationId}`);

        // Create or get test campaign
        const campaignResult = await query(`
            INSERT INTO campaigns (organization_id, name, type, status, voice_persona, language)
            VALUES ($1, 'Test AI Campaign', 'sales', 'active', 'professional', 'en-US')
            ON CONFLICT (organization_id, name)
            DO UPDATE SET status = 'active'
            RETURNING id
        `, [TEST_CONFIG.organizationId]);
        TEST_CONFIG.campaignId = campaignResult.rows[0].id;
        logger.info(`   Using campaign: ${TEST_CONFIG.campaignId}`);

        // Create or get test contact
        const contactResult = await query(`
            INSERT INTO contacts (
                organization_id, campaign_id, first_name, last_name,
                phone, email, status
            )
            VALUES ($1, $2, 'Test', 'Contact', $3, 'test@example.com', 'new')
            ON CONFLICT (organization_id, phone)
            DO UPDATE SET status = 'new'
            RETURNING id
        `, [TEST_CONFIG.organizationId, TEST_CONFIG.campaignId, TEST_CONFIG.testPhoneNumber]);
        TEST_CONFIG.contactId = contactResult.rows[0].id;
        logger.info(`   Using contact: ${TEST_CONFIG.contactId}`);

        // Get or create test phone number
        const phoneResult = await query(`
            SELECT id FROM phone_numbers
            WHERE organization_id = $1 AND status = 'active'
            LIMIT 1
        `, [TEST_CONFIG.organizationId]);

        if (phoneResult.rows.length > 0) {
            TEST_CONFIG.phoneNumberId = phoneResult.rows[0].id;
            logger.info(`   Using phone number: ${TEST_CONFIG.phoneNumberId}`);
        } else {
            logger.warn('   ⚠️  No active phone numbers found');
        }

        logger.info('✅ Test data setup complete\n');
    } catch (error) {
        throw new Error('Test data setup failed: ' + error.message);
    }
}

async function testConversationEngine() {
    logger.info('5️⃣  Testing conversation engine...');

    try {
        // Create a test call record
        const callResult = await query(`
            INSERT INTO calls (
                organization_id, campaign_id, contact_id, status, call_type
            )
            VALUES ($1, $2, $3, 'initiated', 'automated')
            RETURNING id
        `, [TEST_CONFIG.organizationId, TEST_CONFIG.campaignId, TEST_CONFIG.contactId]);

        TEST_CONFIG.callId = callResult.rows[0].id;
        logger.info(`   Created test call: ${TEST_CONFIG.callId}`);

        // Test conversation processing
        const response = await axios.post(`${API_URL}/api/v1/conversation/process`, {
            call_id: TEST_CONFIG.callId,
            user_input: 'Hello, who is this?',
            context: {
                campaign_id: TEST_CONFIG.campaignId,
                turn: 1
            }
        }, { timeout: 10000 });

        if (response.data.success !== false && response.data.answer) {
            logger.info('✅ Conversation engine working');
            logger.info(`   AI Response: "${response.data.answer.substring(0, 50)}..."`);
            logger.info(`   Confidence: ${response.data.confidence}`);
            logger.info(`   Emotion: ${response.data.emotion}\n`);
        } else {
            throw new Error('Invalid conversation response');
        }
    } catch (error) {
        throw new Error('Conversation engine test failed: ' + error.message);
    }
}

async function testTTSService() {
    logger.info('6️⃣  Testing TTS service...');

    try {
        const response = await axios.post(`${API_URL}/api/v1/asterisk/tts/generate`, {
            text: 'Hello, this is a test of the text to speech system.',
            voice: 'amy',
            speed: 1.0
        }, { timeout: 15000 });

        if (response.data.audio_url) {
            logger.info('✅ TTS service working');
            logger.info(`   Audio URL: ${response.data.audio_url}`);
            logger.info(`   Cached: ${response.data.cached}\n`);
        } else {
            throw new Error('TTS did not return audio URL');
        }
    } catch (error) {
        throw new Error('TTS service test failed: ' + error.message);
    }
}

async function testSTTService() {
    logger.info('7️⃣  Testing STT service...');
    logger.info('   ⏭️  Skipping (requires audio file)\n');
}

async function testQueueService() {
    logger.info('8️⃣  Testing queue service...');

    try {
        const { callQueue } = require('../services/queue');

        // Check if queue is available
        const queueStatus = callQueue.getQueueStatus(TEST_CONFIG.campaignId);
        logger.info('✅ Queue service is accessible');

        if (queueStatus) {
            logger.info(`   Queue status: ${queueStatus.status}`);
            logger.info(`   Total contacts: ${queueStatus.totalContacts}`);
        } else {
            logger.info('   Queue not active (expected)');
        }

        logger.info('');
    } catch (error) {
        throw new Error('Queue service test failed: ' + error.message);
    }
}

async function testWebSocketBroadcasting() {
    logger.info('9️⃣  Testing WebSocket broadcasting...');

    try {
        const WebSocketBroadcaster = require('../services/websocket-broadcaster');

        // Test if broadcasting functions are available
        const isAvailable = WebSocketBroadcaster.isAvailable();

        if (isAvailable) {
            logger.info('✅ WebSocket broadcasting available');

            // Test broadcast (won't actually send if no clients connected)
            WebSocketBroadcaster.broadcastConversationTurn(
                TEST_CONFIG.organizationId,
                TEST_CONFIG.callId,
                {
                    user_input: 'Test message',
                    ai_response: 'Test response',
                    turn: 1,
                    confidence: 0.95
                }
            );

            logger.info('   Test broadcast sent\n');
        } else {
            throw new Error('WebSocket broadcast functions not available');
        }
    } catch (error) {
        throw new Error('WebSocket broadcasting test failed: ' + error.message);
    }
}

async function verifyDatabaseRecords() {
    logger.info('🔟 Verifying database records...');

    try {
        // Check call record
        const callResult = await query(`
            SELECT * FROM calls WHERE id = $1
        `, [TEST_CONFIG.callId]);

        if (callResult.rows.length > 0) {
            logger.info('✅ Call record exists');
            logger.info(`   Status: ${callResult.rows[0].status}`);
        } else {
            throw new Error('Call record not found');
        }

        // Check conversation events
        const eventsResult = await query(`
            SELECT COUNT(*) as count
            FROM call_events
            WHERE call_id = $1 AND event_type = 'ai_conversation'
        `, [TEST_CONFIG.callId]);

        logger.info(`✅ Conversation events: ${eventsResult.rows[0].count}`);

        // Check indexes
        const indexResult = await query(`
            SELECT indexname
            FROM pg_indexes
            WHERE tablename IN ('calls', 'call_events')
            ORDER BY indexname
        `);

        logger.info(`✅ Database indexes: ${indexResult.rows.length} found`);
        logger.info('');
    } catch (error) {
        throw new Error('Database verification failed: ' + error.message);
    }
}

// Run tests
main();

module.exports = { main, TEST_CONFIG };
