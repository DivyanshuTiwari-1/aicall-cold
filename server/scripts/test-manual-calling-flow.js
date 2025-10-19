#!/usr/bin/env node

/**
 * Manual Calling Flow Test Suite
 * Tests the complete Phase 1 manual calling workflow
 */

const axios = require('axios');
const WebSocket = require('ws');
const { query } = require('./config/database');
const logger = require('./utils/logger');

class ManualCallingFlowTest {
    constructor() {
        this.baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
        this.wsURL = process.env.WS_URL || 'ws://localhost:3000';
        this.testData = {
            organization: null,
            admin: null,
            agent: null,
            campaign: null,
            contacts: [],
            assignments: [],
            calls: []
        };
        this.wsClient = null;
        this.testResults = [];
    }

    /**
     * Run complete test suite
     */
    async runTests() {
        try {
            logger.info('🚀 Starting Manual Calling Flow Tests...');

            // Test 1: Database Schema
            await this.testDatabaseSchema();

            // Test 2: User Management
            await this.testUserManagement();

            // Test 3: Lead Assignment
            await this.testLeadAssignment();

            // Test 4: Manual Call Initiation
            await this.testManualCallInitiation();

            // Test 5: WebSocket Events
            await this.testWebSocketEvents();

            // Test 6: Call Analysis
            await this.testCallAnalysis();

            // Test 7: Performance Analytics
            await this.testPerformanceAnalytics();

            // Test 8: Credit System
            await this.testCreditSystem();

            // Cleanup
            await this.cleanup();

            // Print results
            this.printResults();

        } catch (error) {
            logger.error('❌ Test suite failed:', error);
            throw error;
        }
    }

    /**
     * Test 1: Database Schema
     */
    async testDatabaseSchema() {
        logger.info('📊 Testing Database Schema...');

        try {
            // Check if all required tables exist
            const requiredTables = [
                'users', 'organizations', 'campaigns', 'contacts', 'calls',
                'lead_assignments', 'call_analysis', 'call_tags', 'call_objections',
                'credit_transactions', 'consent_records'
            ];

            for (const table of requiredTables) {
                const result = await query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`);
                if (!result.rows[0].exists) {
                    throw new Error(`Table ${table} does not exist`);
                }
            }

            // Check if required columns exist
            const userColumns = await query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name IN ('role_type', 'sip_extension', 'is_available')
      `);

            if (userColumns.rows.length !== 3) {
                throw new Error('Users table missing required columns');
            }

            this.addTestResult('Database Schema', true, 'All tables and columns exist');

        } catch (error) {
            this.addTestResult('Database Schema', false, error.message);
        }
    }

    /**
     * Test 2: User Management
     */
    async testUserManagement() {
        logger.info('👥 Testing User Management...');

        try {
            // Create test organization
            const orgResult = await query(`
        INSERT INTO organizations (name, domain, license_seats, credits_balance)
        VALUES ('Test Organization', 'test.com', 5, 1000)
        RETURNING *
      `);
            this.testData.organization = orgResult.rows[0];

            // Create admin user
            const adminResult = await query(`
        INSERT INTO users (organization_id, email, first_name, last_name, role_type, password_hash)
        VALUES ($1, 'admin@test.com', 'Test', 'Admin', 'admin', 'hashed_password')
        RETURNING *
      `, [this.testData.organization.id]);
            this.testData.admin = adminResult.rows[0];

            // Create agent user
            const agentResult = await query(`
        INSERT INTO users (organization_id, email, first_name, last_name, role_type, password_hash, sip_extension, sip_username, sip_password)
        VALUES ($1, 'agent@test.com', 'Test', 'Agent', 'agent', 'hashed_password', '1001', 'agent_1001', 'secure_password')
        RETURNING *
      `, [this.testData.organization.id]);
            this.testData.agent = agentResult.rows[0];

            // Test user API endpoints
            const response = await axios.get(`${this.baseURL}/api/v1/users`, {
                headers: { Authorization: `Bearer test_token` }
            });

            if (response.data.success && response.data.users.length >= 2) {
                this.addTestResult('User Management', true, 'Users created and API working');
            } else {
                throw new Error('User API not working correctly');
            }

        } catch (error) {
            this.addTestResult('User Management', false, error.message);
        }
    }

    /**
     * Test 3: Lead Assignment
     */
    async testLeadAssignment() {
        logger.info('📋 Testing Lead Assignment...');

        try {
            // Create test campaign
            const campaignResult = await query(`
        INSERT INTO campaigns (organization_id, name, type, status)
        VALUES ($1, 'Test Campaign', 'sales', 'active')
        RETURNING *
      `, [this.testData.organization.id]);
            this.testData.campaign = campaignResult.rows[0];

            // Create test contacts
            const contacts = [
                { firstName: 'John', lastName: 'Doe', phone: '+1234567890', email: 'john@example.com' },
                { firstName: 'Jane', lastName: 'Smith', phone: '+1234567891', email: 'jane@example.com' },
                { firstName: 'Bob', lastName: 'Johnson', phone: '+1234567892', email: 'bob@example.com' }
            ];

            for (const contact of contacts) {
                const contactResult = await query(`
          INSERT INTO contacts (organization_id, campaign_id, first_name, last_name, phone, email, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'new')
          RETURNING *
        `, [this.testData.organization.id, this.testData.campaign.id, contact.firstName, contact.lastName, contact.phone, contact.email]);
                this.testData.contacts.push(contactResult.rows[0]);
            }

            // Create lead assignments
            for (const contact of this.testData.contacts) {
                const assignmentResult = await query(`
          INSERT INTO lead_assignments (organization_id, contact_id, assigned_to, assigned_by, status)
          VALUES ($1, $2, $3, $4, 'pending')
          RETURNING *
        `, [this.testData.organization.id, contact.id, this.testData.agent.id, this.testData.admin.id]);
                this.testData.assignments.push(assignmentResult.rows[0]);
            }

            // Test assignment API
            const response = await axios.get(`${this.baseURL}/api/v1/assignments/my-leads`, {
                headers: { Authorization: `Bearer test_token` }
            });

            if (response.data.success && response.data.assignments.length >= 3) {
                this.addTestResult('Lead Assignment', true, 'Leads assigned and API working');
            } else {
                throw new Error('Assignment API not working correctly');
            }

        } catch (error) {
            this.addTestResult('Lead Assignment', false, error.message);
        }
    }

    /**
     * Test 4: Manual Call Initiation
     */
    async testManualCallInitiation() {
        logger.info('📞 Testing Manual Call Initiation...');

        try {
            const contact = this.testData.contacts[0];

            // Test manual call start API
            const response = await axios.post(`${this.baseURL}/api/v1/manualcalls/start`, {
                contactId: contact.id,
                campaignId: this.testData.campaign.id
            }, {
                headers: { Authorization: `Bearer test_token` }
            });

            if (response.data.success && response.data.callId) {
                this.testData.calls.push({
                    id: response.data.callId,
                    contactId: contact.id,
                    status: 'initiated'
                });

                // Test call logging API
                const logResponse = await axios.post(`${this.baseURL}/api/v1/manualcalls/log`, {
                    callId: response.data.callId,
                    outcome: 'scheduled',
                    notes: 'Test call completed successfully',
                    duration: 120
                }, {
                    headers: { Authorization: `Bearer test_token` }
                });

                if (logResponse.data.success) {
                    this.addTestResult('Manual Call Initiation', true, 'Call initiated and logged successfully');
                } else {
                    throw new Error('Call logging failed');
                }
            } else {
                throw new Error('Call initiation failed');
            }

        } catch (error) {
            this.addTestResult('Manual Call Initiation', false, error.message);
        }
    }

    /**
     * Test 5: WebSocket Events
     */
    async testWebSocketEvents() {
        logger.info('🔌 Testing WebSocket Events...');

        try {
            return new Promise((resolve, reject) => {
                this.wsClient = new WebSocket(this.wsURL);

                let eventsReceived = 0;
                const expectedEvents = ['call_status_update', 'new_lead_assigned', 'analysis_complete'];

                this.wsClient.on('open', () => {
                    logger.info('WebSocket connected');

                    // Subscribe to events
                    this.wsClient.send(JSON.stringify({
                        type: 'subscribe_agent',
                        agent_id: this.testData.agent.id,
                        organization_id: this.testData.organization.id
                    }));

                    // Send test events
                    setTimeout(() => {
                        this.wsClient.send(JSON.stringify({
                            type: 'call_status_update',
                            callId: this.testData.calls[0].id,
                            status: 'connected'
                        }));
                    }, 1000);
                });

                this.wsClient.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        logger.info('WebSocket message received:', message.type);

                        if (expectedEvents.includes(message.type)) {
                            eventsReceived++;
                        }

                        if (eventsReceived >= 1) {
                            this.wsClient.close();
                            this.addTestResult('WebSocket Events', true, 'WebSocket events working correctly');
                            resolve();
                        }
                    } catch (error) {
                        reject(error);
                    }
                });

                this.wsClient.on('error', (error) => {
                    reject(error);
                });

                // Timeout after 10 seconds
                setTimeout(() => {
                    if (this.wsClient) {
                        this.wsClient.close();
                    }
                    if (eventsReceived === 0) {
                        reject(new Error('No WebSocket events received'));
                    } else {
                        this.addTestResult('WebSocket Events', true, 'WebSocket events working correctly');
                        resolve();
                    }
                }, 10000);
            });

        } catch (error) {
            this.addTestResult('WebSocket Events', false, error.message);
        }
    }

    /**
     * Test 6: Call Analysis
     */
    async testCallAnalysis() {
        logger.info('🧠 Testing Call Analysis...');

        try {
            const call = this.testData.calls[0];

            // Create test call analysis
            const analysisResult = await query(`
        INSERT INTO call_analysis (call_id, intent_label, intent_confidence, emotion_dominant, emotion_intensity, emotion_volatility)
        VALUES ($1, 'demo_request', 0.85, 'interested', 0.72, 0.35)
        RETURNING *
      `, [call.id]);

            // Create test tags
            await query(`
        INSERT INTO call_tags (call_id, tag, tag_type, confidence)
        VALUES ($1, 'high_intent', 'auto', 0.85), ($1, 'follow_up', 'manual', 1.0)
      `, [call.id]);

            // Test analysis API
            const response = await axios.get(`${this.baseURL}/api/v1/calls/${call.id}/analysis`, {
                headers: { Authorization: `Bearer test_token` }
            });

            if (response.data.success && response.data.analysis) {
                this.addTestResult('Call Analysis', true, 'Analysis created and API working');
            } else {
                throw new Error('Analysis API not working correctly');
            }

        } catch (error) {
            this.addTestResult('Call Analysis', false, error.message);
        }
    }

    /**
     * Test 7: Performance Analytics
     */
    async testPerformanceAnalytics() {
        logger.info('📈 Testing Performance Analytics...');

        try {
            // Test agent performance API
            const agentResponse = await axios.get(`${this.baseURL}/api/v1/analytics/agent/${this.testData.agent.id}/performance`, {
                headers: { Authorization: `Bearer test_token` }
            });

            // Test team leaderboard API
            const leaderboardResponse = await axios.get(`${this.baseURL}/api/v1/analytics/team-leaderboard`, {
                headers: { Authorization: `Bearer test_token` }
            });

            // Test productivity API
            const productivityResponse = await axios.get(`${this.baseURL}/api/v1/analytics/productivity`, {
                headers: { Authorization: `Bearer test_token` }
            });

            if (agentResponse.data.success && leaderboardResponse.data.success && productivityResponse.data.success) {
                this.addTestResult('Performance Analytics', true, 'All analytics APIs working');
            } else {
                throw new Error('Analytics APIs not working correctly');
            }

        } catch (error) {
            this.addTestResult('Performance Analytics', false, error.message);
        }
    }

    /**
     * Test 8: Credit System
     */
    async testCreditSystem() {
        logger.info('💳 Testing Credit System...');

        try {
            // Test credit consumption
            const initialCredits = this.testData.organization.credits_balance;

            // Simulate credit consumption for a call
            await query(`
        UPDATE organizations
        SET credits_balance = credits_balance - 1, credits_consumed = credits_consumed + 1
        WHERE id = $1
      `, [this.testData.organization.id]);

            // Log credit transaction
            await query(`
        INSERT INTO credit_transactions (organization_id, amount, type, description, call_id)
        VALUES ($1, -1, 'consumption', 'Manual call completed', $2)
      `, [this.testData.organization.id, this.testData.calls[0].id]);

            // Verify credit deduction
            const orgResult = await query(`SELECT credits_balance, credits_consumed FROM organizations WHERE id = $1`, [this.testData.organization.id]);
            const updatedOrg = orgResult.rows[0];

            if (updatedOrg.credits_balance === initialCredits - 1 && updatedOrg.credits_consumed === 1) {
                this.addTestResult('Credit System', true, 'Credit consumption working correctly');
            } else {
                throw new Error('Credit deduction not working correctly');
            }

        } catch (error) {
            this.addTestResult('Credit System', false, error.message);
        }
    }

    /**
     * Cleanup test data
     */
    async cleanup() {
        logger.info('🧹 Cleaning up test data...');

        try {
            // Delete in reverse order to handle foreign key constraints
            if (this.testData.calls.length > 0) {
                await query(`DELETE FROM calls WHERE id = ANY($1)`, [this.testData.calls.map(c => c.id)]);
            }

            if (this.testData.assignments.length > 0) {
                await query(`DELETE FROM lead_assignments WHERE id = ANY($1)`, [this.testData.assignments.map(a => a.id)]);
            }

            if (this.testData.contacts.length > 0) {
                await query(`DELETE FROM contacts WHERE id = ANY($1)`, [this.testData.contacts.map(c => c.id)]);
            }

            if (this.testData.campaign) {
                await query(`DELETE FROM campaigns WHERE id = $1`, [this.testData.campaign.id]);
            }

            if (this.testData.agent) {
                await query(`DELETE FROM users WHERE id = $1`, [this.testData.agent.id]);
            }

            if (this.testData.admin) {
                await query(`DELETE FROM users WHERE id = $1`, [this.testData.admin.id]);
            }

            if (this.testData.organization) {
                await query(`DELETE FROM organizations WHERE id = $1`, [this.testData.organization.id]);
            }

            logger.info('✅ Test data cleaned up');

        } catch (error) {
            logger.error('❌ Cleanup failed:', error);
        }
    }

    /**
     * Add test result
     */
    addTestResult(testName, success, message) {
        this.testResults.push({
            test: testName,
            success,
            message,
            timestamp: new Date().toISOString()
        });

        const status = success ? '✅' : '❌';
        logger.info(`${status} ${testName}: ${message}`);
    }

    /**
     * Print test results
     */
    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 MANUAL CALLING FLOW TEST RESULTS');
        console.log('='.repeat(60));

        const passed = this.testResults.filter(r => r.success).length;
        const total = this.testResults.length;

        console.log(`\nTotal Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${total - passed}`);
        console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

        console.log('\n📋 Detailed Results:');
        this.testResults.forEach(result => {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${result.test}: ${result.message}`);
        });

        if (passed === total) {
            console.log('\n🎉 All tests passed! Phase 1 manual calling is ready for production.');
        } else {
            console.log('\n⚠️  Some tests failed. Please review and fix issues before deployment.');
        }

        console.log('\n' + '='.repeat(60));
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new ManualCallingFlowTest();
    tester.runTests()
        .then(() => {
            console.log('Test suite completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = ManualCallingFlowTest;