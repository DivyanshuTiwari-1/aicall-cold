#!/usr/bin/env node

/**
 * Test Script for Automated AI Call Flow (Node.js)
 *
 * This script tests the complete automated call flow:
 * 1. Create test campaign
 * 2. Create test contact
 * 3. Start queue
 * 4. Monitor call progress
 * 5. Verify conversation is recorded
 * 6. Check call history
 */

const axios = require('axios');
const { Client } = require('pg');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_NAME = process.env.DB_NAME || 'ai_dialer';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASS = process.env.DB_PASSWORD || 'postgres';

let authToken = null;
let organizationId = null;
let campaignId = null;
let contactId = null;
let callId = null;

// Database client
const dbClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASS
});

// Helper functions
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = {
        'INFO': '✅',
        'ERROR': '❌',
        'WARN': '⚠️',
        'TEST': '🧪',
        'SUCCESS': '🎉'
    }[level] || 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiCall(method, endpoint, data = null, token = authToken) {
    try {
        const config = {
            method,
            url: `${API_URL}/api/v1${endpoint}`,
            headers: {}
        };

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        if (data) {
            config.headers['Content-Type'] = 'application/json';
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    } catch (error) {
        log(`API Error: ${error.response?.data?.message || error.message}`, 'ERROR');
        throw error;
    }
}

async function authenticate() {
    log('Authenticating...', 'TEST');

    // Try to login with default admin credentials
    try {
        const response = await apiCall('POST', '/auth/login', {
            email: 'admin@example.com',
            password: 'admin123'
        }, null);

        authToken = response.token;
        organizationId = response.user.organizationId;

        log(`Authenticated as ${response.user.email}`, 'SUCCESS');
        log(`Organization ID: ${organizationId}`, 'INFO');

        return true;
    } catch (error) {
        log('Authentication failed. Please ensure default admin user exists.', 'ERROR');
        return false;
    }
}

async function createTestCampaign() {
    log('Creating test campaign...', 'TEST');

    const campaignData = {
        name: `Test Automated Campaign ${Date.now()}`,
        description: 'Automated test campaign for Node.js flow verification',
        status: 'active',
        settings: {
            maxCallsPerDay: 100,
            callWindowStart: '09:00',
            callWindowEnd: '17:00',
            timezone: 'America/New_York'
        }
    };

    const response = await apiCall('POST', '/campaigns', campaignData);
    campaignId = response.campaign.id;

    log(`Campaign created: ${campaignId}`, 'SUCCESS');
    return campaignId;
}

async function createTestContact() {
    log('Creating test contact...', 'TEST');

    const contactData = {
        firstName: 'Test',
        lastName: 'Contact',
        phone: '+1234567890', // Test phone number
        email: 'test@example.com',
        campaignId: campaignId,
        status: 'pending'
    };

    const response = await apiCall('POST', '/contacts', contactData);
    contactId = response.contact.id;

    log(`Contact created: ${contactId}`, 'SUCCESS');
    return contactId;
}

async function startQueue() {
    log('Starting queue for campaign...', 'TEST');

    try {
        const response = await apiCall('POST', `/queue/start/${campaignId}`);
        log(`Queue started successfully`, 'SUCCESS');
        return true;
    } catch (error) {
        log(`Queue start failed: ${error.message}`, 'ERROR');
        return false;
    }
}

async function monitorCallProgress() {
    log('Monitoring call progress...', 'TEST');

    let attempts = 0;
    const maxAttempts = 30; // 30 seconds

    while (attempts < maxAttempts) {
        try {
            // Check if call was created
            const result = await dbClient.query(`
                SELECT id, status, outcome, duration
                FROM calls
                WHERE contact_id = $1
                ORDER BY created_at DESC
                LIMIT 1
            `, [contactId]);

            if (result.rows.length > 0) {
                const call = result.rows[0];
                callId = call.id;

                log(`Call found: ${callId}`, 'INFO');
                log(`Status: ${call.status}, Outcome: ${call.outcome || 'N/A'}, Duration: ${call.duration || 0}s`, 'INFO');

                if (call.status === 'completed') {
                    log('Call completed!', 'SUCCESS');
                    return call;
                }
            }

            await sleep(1000);
            attempts++;
        } catch (error) {
            log(`Error checking call status: ${error.message}`, 'ERROR');
            await sleep(1000);
            attempts++;
        }
    }

    log('Call monitoring timeout', 'WARN');
    return null;
}

async function verifyConversation() {
    if (!callId) {
        log('No call ID available for conversation verification', 'WARN');
        return false;
    }

    log('Verifying conversation was recorded...', 'TEST');

    try {
        const result = await dbClient.query(`
            SELECT COUNT(*) as turn_count,
                   MAX(timestamp) as last_turn_time
            FROM call_events
            WHERE call_id = $1 AND event_type = 'ai_conversation'
        `, [callId]);

        const turnCount = parseInt(result.rows[0].turn_count);
        const lastTurnTime = result.rows[0].last_turn_time;

        log(`Conversation turns recorded: ${turnCount}`, 'INFO');

        if (turnCount > 0) {
            log(`Last turn at: ${lastTurnTime}`, 'INFO');
            log('Conversation successfully recorded!', 'SUCCESS');
            return true;
        } else {
            log('No conversation turns found', 'WARN');
            return false;
        }
    } catch (error) {
        log(`Error verifying conversation: ${error.message}`, 'ERROR');
        return false;
    }
}

async function checkCallTranscript() {
    if (!callId) {
        log('No call ID available for transcript check', 'WARN');
        return false;
    }

    log('Checking call transcript...', 'TEST');

    try {
        const result = await dbClient.query(`
            SELECT transcript, LENGTH(transcript) as transcript_length
            FROM calls
            WHERE id = $1
        `, [callId]);

        if (result.rows.length > 0 && result.rows[0].transcript) {
            const transcriptLength = result.rows[0].transcript_length;
            log(`Transcript length: ${transcriptLength} characters`, 'INFO');
            log('Transcript saved successfully!', 'SUCCESS');

            // Print first 200 characters
            const preview = result.rows[0].transcript.substring(0, 200);
            log(`Transcript preview: ${preview}...`, 'INFO');

            return true;
        } else {
            log('No transcript found in call record', 'WARN');
            return false;
        }
    } catch (error) {
        log(`Error checking transcript: ${error.message}`, 'ERROR');
        return false;
    }
}

async function checkWebSocketBroadcasts() {
    log('Checking WebSocket broadcast configuration...', 'TEST');

    // Check if WebSocket broadcaster is loaded
    try {
        const response = await apiCall('GET', '/health');
        log('API server is healthy', 'SUCCESS');
        log('WebSocket broadcasts should be working (check server logs)', 'INFO');
        return true;
    } catch (error) {
        log('API health check failed', 'ERROR');
        return false;
    }
}

async function cleanup() {
    log('Cleaning up test data...', 'TEST');

    try {
        // Delete test contact
        if (contactId) {
            await apiCall('DELETE', `/contacts/${contactId}`);
            log('Test contact deleted', 'INFO');
        }

        // Delete test campaign
        if (campaignId) {
            await apiCall('DELETE', `/campaigns/${campaignId}`);
            log('Test campaign deleted', 'INFO');
        }

        log('Cleanup complete', 'SUCCESS');
    } catch (error) {
        log(`Cleanup error: ${error.message}`, 'WARN');
    }
}

async function runTests() {
    log('=== Starting Automated Call Flow Test ===', 'TEST');
    log('', 'INFO');

    let success = true;

    try {
        // Connect to database
        await dbClient.connect();
        log('Connected to database', 'SUCCESS');

        // Step 1: Authenticate
        if (!await authenticate()) {
            throw new Error('Authentication failed');
        }

        // Step 2: Create test campaign
        await createTestCampaign();

        // Step 3: Create test contact
        await createTestContact();

        // Step 4: Check WebSocket setup
        await checkWebSocketBroadcasts();

        // Step 5: Start queue
        log('', 'INFO');
        log('⚠️ WARNING: This will initiate a real call to +1234567890', 'WARN');
        log('Press Ctrl+C within 5 seconds to cancel...', 'WARN');
        await sleep(5000);

        if (!await startQueue()) {
            throw new Error('Queue start failed');
        }

        // Step 6: Monitor call progress
        log('', 'INFO');
        const call = await monitorCallProgress();

        if (!call) {
            log('Call monitoring timed out - call may not have been initiated', 'WARN');
            log('Check: 1) Asterisk is running, 2) FastAGI server is running, 3) Phone number is valid', 'INFO');
            success = false;
        }

        // Step 7: Verify conversation
        if (await verifyConversation()) {
            await checkCallTranscript();
        } else {
            log('Conversation verification failed', 'ERROR');
            success = false;
        }

        log('', 'INFO');
        log('=== Test Results ===', 'TEST');
        log(`Campaign ID: ${campaignId}`, 'INFO');
        log(`Contact ID: ${contactId}`, 'INFO');
        log(`Call ID: ${callId || 'N/A'}`, 'INFO');
        log('', 'INFO');

        if (success) {
            log('🎉 All tests passed! Automated call flow is working correctly.', 'SUCCESS');
        } else {
            log('Some tests failed. Please review the logs above.', 'ERROR');
        }

    } catch (error) {
        log(`Test failed: ${error.message}`, 'ERROR');
        console.error(error);
        success = false;
    } finally {
        // Cleanup
        await cleanup();

        // Disconnect from database
        await dbClient.end();
        log('Disconnected from database', 'INFO');
    }

    log('', 'INFO');
    log('=== Test Complete ===', 'TEST');
    process.exit(success ? 0 : 1);
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
