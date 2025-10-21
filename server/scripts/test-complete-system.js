const { query } = require('../config/database');
const logger = require('../utils/logger');
const stasisManager = require('../services/stasis-apps');
const sipProvisioning = require('../services/sip-provisioning');

class SystemTest {
    constructor() {
        this.testResults = [];
        this.passed = 0;
        this.failed = 0;
    }

    async runTest(testName, testFunction) {
        try {
            logger.info(`🧪 Running test: ${testName}`);
            const result = await testFunction();
            this.testResults.push({ name: testName, status: 'PASS', result });
            this.passed++;
            logger.info(`✅ ${testName}: PASSED`);
            return result;
        } catch (error) {
            this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
            this.failed++;
            logger.error(`❌ ${testName}: FAILED - ${error.message}`);
            throw error;
        }
    }

    async testDatabaseConnection() {
        const result = await query('SELECT NOW() as current_time');
        if (!result.rows[0]) {
            throw new Error('Database query returned no results');
        }
        return { connected: true, time: result.rows[0].current_time };
    }

    async testSipFieldsExist() {
        const result = await query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name IN ('sip_extension', 'sip_username', 'sip_password')
        `);

        const columns = result.rows.map(row => row.column_name);
        const required = ['sip_extension', 'sip_username', 'sip_password'];
        const missing = required.filter(col => !columns.includes(col));

        if (missing.length > 0) {
            throw new Error(`Missing SIP columns: ${missing.join(', ')}`);
        }

        return { columns, allPresent: true };
    }

    async testAsteriskAriConnection() {
        const healthCheck = await stasisManager.healthCheck();
        if (healthCheck.status !== 'connected') {
            throw new Error(`ARI not connected: ${healthCheck.message}`);
        }
        return healthCheck;
    }

    async testStasisAppsRunning() {
        const activeCalls = stasisManager.getActiveCalls();
        return {
            aiDialerApp: !!stasisManager.getAiDialerApp(),
            manualBridgeApp: !!stasisManager.getManualBridgeApp(),
            activeCalls: activeCalls.total
        };
    }

    async testSipProvisioningService() {
        // Test if config file exists
        const configExists = await sipProvisioning.configFileExists();
        if (!configExists) {
            throw new Error('SIP dynamic config file does not exist');
        }

        // Test listing agents (should work even if empty)
        const agents = await sipProvisioning.listProvisionedAgents();

        return {
            configFileExists: configExists,
            configPath: sipProvisioning.getConfigFilePath(),
            provisionedAgents: agents.length
        };
    }

    async testTelnyxConfiguration() {
        const requiredEnvVars = [
            'TELNYX_USERNAME',
            'TELNYX_PASSWORD',
            'TELNYX_DOMAIN',
            'TELNYX_SIP_URI',
            'TELNYX_CALLER_ID',
            'TELNYX_DID'
        ];

        const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
        if (missing.length > 0) {
            throw new Error(`Missing Telnyx environment variables: ${missing.join(', ')}`);
        }

        return {
            configured: true,
            variables: requiredEnvVars.map(envVar => ({
                name: envVar,
                set: !!process.env[envVar],
                value: process.env[envVar] ? '***' : undefined
            }))
        };
    }

    async testAsteriskConfiguration() {
        const fs = require('fs').promises;
        const path = require('path');

        const configFiles = [
            'asterisk-config/pjsip.conf',
            'asterisk-config/extensions.conf',
            'asterisk-config/http.conf',
            'asterisk-config/pjsip_dynamic.conf'
        ];

        const results = {};
        for (const file of configFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                results[file] = { exists: true, size: content.length };
            } catch (error) {
                results[file] = { exists: false, error: error.message };
            }
        }

        return results;
    }

    async testApiEndpoints() {
        const endpoints = [
            '/api/v1/health',
            '/api/v1/users/me/sip-credentials'
        ];

        const results = {};
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`http://localhost:3000${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.TEST_TOKEN || 'test-token'}`
                    }
                });
                results[endpoint] = {
                    status: response.status,
                    ok: response.ok
                };
            } catch (error) {
                results[endpoint] = {
                    error: error.message
                };
            }
        }

        return results;
    }

    async runAllTests() {
        logger.info('🚀 Starting Complete System Test Suite');
        logger.info('=====================================');

        try {
            // Core Infrastructure Tests
            await this.runTest('Database Connection', () => this.testDatabaseConnection());
            await this.runTest('SIP Database Fields', () => this.testSipFieldsExist());
            await this.runTest('Asterisk ARI Connection', () => this.testAsteriskAriConnection());
            await this.runTest('Stasis Applications', () => this.testStasisAppsRunning());

            // Configuration Tests
            await this.runTest('SIP Provisioning Service', () => this.testSipProvisioningService());
            await this.runTest('Telnyx Configuration', () => this.testTelnyxConfiguration());
            await this.runTest('Asterisk Configuration Files', () => this.testAsteriskConfiguration());

            // API Tests
            await this.runTest('API Endpoints', () => this.testApiEndpoints());

            // Summary
            logger.info('=====================================');
            logger.info(`📊 Test Results: ${this.passed} passed, ${this.failed} failed`);

            if (this.failed === 0) {
                logger.info('🎉 All tests passed! System is ready for calls.');
                return { success: true, results: this.testResults };
            } else {
                logger.error('❌ Some tests failed. Please check the errors above.');
                return { success: false, results: this.testResults };
            }

        } catch (error) {
            logger.error('💥 Test suite failed:', error);
            return { success: false, error: error.message, results: this.testResults };
        }
    }

    printDetailedResults() {
        logger.info('\n📋 Detailed Test Results:');
        logger.info('========================');

        this.testResults.forEach((test, index) => {
            const status = test.status === 'PASS' ? '✅' : '❌';
            logger.info(`${index + 1}. ${status} ${test.name}`);

            if (test.status === 'FAIL') {
                logger.info(`   Error: ${test.error}`);
            } else if (test.result) {
                logger.info(`   Result: ${JSON.stringify(test.result, null, 2)}`);
            }
        });
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new SystemTest();

    tester.runAllTests()
        .then((result) => {
            tester.printDetailedResults();

            if (result.success) {
                logger.info('\n🎉 System is ready for manual and automated calls!');
                process.exit(0);
            } else {
                logger.error('\n❌ System is not ready. Please fix the issues above.');
                process.exit(1);
            }
        })
        .catch((error) => {
            logger.error('Test suite crashed:', error);
            process.exit(1);
        });
}

module.exports = SystemTest;
