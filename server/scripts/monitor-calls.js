#!/usr/bin/env node

/**
 * Monitor Call Progress
 * Real-time monitoring of automated call queue progress
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

class CallMonitor {
    constructor() {
        this.isMonitoring = false;
        this.monitorInterval = null;
    }

    async startMonitoring() {
        console.log('🔍 Starting Call Progress Monitor...\n');
        this.isMonitoring = true;

        this.monitorInterval = setInterval(async () => {
            await this.checkCallProgress();
        }, 5000); // Check every 5 seconds
    }

    async stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.isMonitoring = false;
        console.log('\n🛑 Call monitoring stopped');
    }

    async checkCallProgress() {
        try {
            // Get campaign stats
            const campaignStats = await query(`
                SELECT
                    c.id,
                    c.name,
                    COUNT(ct.id) as total_contacts,
                    COUNT(call.id) as total_calls,
                    COUNT(CASE WHEN call.status = 'completed' THEN 1 END) as completed_calls,
                    COUNT(CASE WHEN call.status = 'initiated' THEN 1 END) as initiated_calls,
                    COUNT(CASE WHEN call.status = 'in_progress' THEN 1 END) as active_calls,
                    COUNT(CASE WHEN call.outcome = 'scheduled' THEN 1 END) as scheduled_calls,
                    COUNT(CASE WHEN call.outcome = 'interested' THEN 1 END) as interested_calls,
                    COUNT(CASE WHEN call.outcome = 'not_interested' THEN 1 END) as not_interested_calls
                FROM campaigns c
                LEFT JOIN contacts ct ON c.id = ct.campaign_id
                LEFT JOIN calls call ON c.id = call.campaign_id
                WHERE c.name = 'Family Test Campaign'
                GROUP BY c.id, c.name
            `);

            if (campaignStats.rows.length > 0) {
                const stats = campaignStats.rows[0];
                this.displayStats(stats);
            }

            // Get recent calls
            const recentCalls = await query(`
                SELECT
                    call.id,
                    call.status,
                    call.outcome,
                    call.duration,
                    call.created_at,
                    ct.first_name,
                    ct.last_name,
                    ct.phone
                FROM calls call
                JOIN contacts ct ON call.contact_id = ct.id
                JOIN campaigns c ON call.campaign_id = c.id
                WHERE c.name = 'Family Test Campaign'
                ORDER BY call.created_at DESC
                LIMIT 5
            `);

            if (recentCalls.rows.length > 0) {
                this.displayRecentCalls(recentCalls.rows);
            }

        } catch (error) {
            console.error('❌ Monitoring error:', error.message);
        }
    }

    displayStats(stats) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`\n📊 [${timestamp}] Campaign Stats:`);
        console.log(`   Campaign: ${stats.name}`);
        console.log(`   Total Contacts: ${stats.total_contacts}`);
        console.log(`   Total Calls: ${stats.total_calls}`);
        console.log(`   Active Calls: ${stats.active_calls}`);
        console.log(`   Completed Calls: ${stats.completed_calls}`);
        console.log(`   Scheduled: ${stats.scheduled_calls}`);
        console.log(`   Interested: ${stats.interested_calls}`);
        console.log(`   Not Interested: ${stats.not_interested_calls}`);
    }

    displayRecentCalls(calls) {
        console.log(`\n📞 Recent Calls:`);
        calls.forEach(call => {
            const time = new Date(call.created_at).toLocaleTimeString();
            const status = call.status || 'unknown';
            const outcome = call.outcome || 'pending';
            const duration = call.duration ? `${call.duration}s` : '-';
            console.log(`   ${time} | ${call.first_name} ${call.last_name} (${call.phone}) | ${status} | ${outcome} | ${duration}`);
        });
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down monitor...');
    if (global.monitor) {
        await global.monitor.stopMonitoring();
    }
    process.exit(0);
});

// Start monitoring
if (require.main === module) {
    const monitor = new CallMonitor();
    global.monitor = monitor;

    console.log('🎯 Call Progress Monitor');
    console.log('========================');
    console.log('Press Ctrl+C to stop monitoring\n');

    monitor.startMonitoring();
}

module.exports = CallMonitor;
