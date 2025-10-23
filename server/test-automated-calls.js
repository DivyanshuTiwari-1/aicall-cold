/**
 * Test Automated Calls with Telnyx
 *
 * This script will:
 * 1. Create a test campaign
 * 2. Upload 5-10 test contacts
 * 3. Start automated calls
 * 4. Monitor call progress and save to call history
 */

const axios = require('axios');
const { query } = require('./config/database');
const logger = require('./utils/logger');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
const TEST_CONTACTS = [
    {
        first_name: 'Michael',
        last_name: 'Ricordeau',
        phone: '+14154305338',
        email: 'michael@plivo.com',
        company: 'Plivo',
        title: 'Founder & CTO'
    },
    {
        first_name: 'Bryon',
        last_name: 'Jacob',
        phone: '+15127510691',
        email: 'bryon@data.world',
        company: 'Data.world',
        title: 'CTO and Co-founder'
    },
    {
        first_name: 'Todd',
        last_name: 'Cornett',
        phone: '+12023214227',
        email: 'todd.cornett@growthzone.com',
        company: 'GrowthZone',
        title: 'CTO and Co-Founder'
    },
    {
        first_name: 'Billy',
        last_name: 'Phillips',
        phone: '+12032472762',
        email: 'billy.phillips@productboard.com',
        company: 'Productboard',
        title: 'Chief of Staff to the CEO'
    },
    {
        first_name: 'Alex',
        last_name: 'McNamara',
        phone: '+12063849441',
        email: 'amcnamara@orionlabs.io',
        company: 'Orion Labs',
        title: 'Chief Technology Officer'
    },
    {
        first_name: 'Chuck',
        last_name: 'Weisbrich',
        phone: '+12103167471',
        email: 'chuck.weisbrich@unitedtraining.com',
        company: 'United Training',
        title: 'Chief Of Staff'
    },
    {
        first_name: 'Paul',
        last_name: 'Kadzielski',
        phone: '+12139780741',
        email: 'paul@slingshotaerospace.com',
        company: 'Slingshot Aerospace',
        title: 'Chief Of Staff'
    },
    {
        first_name: 'Phil',
        last_name: 'Bianco',
        phone: '+12153567798',
        email: 'bianco@mjm.com',
        company: 'MJM',
        title: 'Chief Technology Officer'
    },
    {
        first_name: 'Kevin',
        last_name: 'Fox',
        phone: '+12158373121',
        email: 'kfox@ycharts.com',
        company: 'YCharts',
        title: 'CTO'
    },
    {
        first_name: 'Debbie',
        last_name: 'Peterson',
        phone: '+12392922766',
        email: 'debbie.peterson@callminer.com',
        company: 'CallMiner',
        title: 'Vice President & Chief of Staff'
    },
    {
        first_name: 'Michael',
        last_name: 'Barrett',
        phone: '+12623370182',
        email: 'mbarrett@river-run.com',
        company: 'River Run',
        title: 'Chief Information Technology Officer'
    },
    {
        first_name: 'Brian',
        last_name: 'Petted',
        phone: '+12628939433',
        email: 'brian.petted@lairdconnect.com',
        company: 'Laird',
        title: 'Technology Leader / Chief Technology Officer'
    },
    {
        first_name: 'Jason',
        last_name: 'Trespalacios',
        phone: '+12672888828',
        email: 'jason.tres@alphait.us',
        company: 'Alpha IT',
        title: 'Global IT Director, Technology Service Management'
    },
    {
        first_name: 'Ajay',
        last_name: '',
        phone: '+12812163790',
        email: 'ag@kamivision.com',
        company: 'Kami Vision',
        title: 'Chief Technology Officer'
    },
    {
        first_name: 'Mark',
        last_name: 'Oreta',
        phone: '+12817409227',
        email: 'm.oreta@jobtarget.com',
        company: 'JobTarget',
        title: 'Chief Technology Officer'
    },
    {
        first_name: 'Matt',
        last_name: 'Bigelow',
        phone: '+13016848080',
        email: 'matt.bigelow@staxpayments.com',
        company: 'Stax Payments',
        title: 'Chief Of Staff'
    },
    {
        first_name: 'Jesus',
        last_name: 'Jackson',
        phone: '+13019043045',
        email: 'jesus.jackson@ardentmc.com',
        company: 'ArdentMC',
        title: 'Chief Technology Officer'
    },
    {
        first_name: 'David',
        last_name: 'Gargan',
        phone: '+13035192487',
        email: 'dgargan@vendavo.com',
        company: 'Vendavo',
        title: 'Director Of Information Technology'
    },
    {
        first_name: 'Annabelle',
        last_name: 'Hohmann',
        phone: '+13107546270',
        email: 'ahohmann@missioncloud.com',
        company: 'Mission Cloud',
        title: 'VP, Chief of Staff'
    }
];


let authToken = null;
let organizationId = null;
let campaignId = null;
let contactIds = [];

// Login and get auth token
async function login() {
    try {
        console.log('🔐 Logging in...');
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: 'admin@example.com',
            password: 'admin123'
        });

        if (response.data.success) {
            authToken = response.data.token;
            organizationId = response.data.user.organization_id;
            console.log('✅ Login successful');
            console.log(`   Organization ID: ${organizationId}`);
            return true;
        } else {
            console.error('❌ Login failed:', response.data.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Login error:', error.response?.data || error.message);
        return false;
    }
}

// Create test campaign
async function createCampaign() {
    try {
        console.log('\n📋 Creating test campaign...');
        const response = await axios.post(
            `${API_BASE_URL}/campaigns`,
            {
                name: `Automated Test Campaign ${Date.now()}`,
                type: 'sales',
                status: 'draft',
                description: 'Test campaign for automated calls with Telnyx',
                voice_persona: 'professional',
                language: 'en-US',
                accent: 'professional',
                auto_retry: true,
                best_time_enabled: true,
                emotion_detection: true,
                callSettings: {
                    maxConcurrentCalls: 3,
                    retryAttempts: 2,
                    retryDelayMinutes: 30,
                    callTimeoutSeconds: 30
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${authToken}`
                }
            }
        );

        if (response.data.success) {
            campaignId = response.data.campaign.id;
            console.log('✅ Campaign created successfully');
            console.log(`   Campaign ID: ${campaignId}`);
            console.log(`   Campaign Name: ${response.data.campaign.name}`);
            return true;
        } else {
            console.error('❌ Campaign creation failed:', response.data.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Campaign creation error:', error.response?.data || error.message);
        return false;
    }
}

// Upload contacts to campaign
async function uploadContacts() {
    try {
        console.log('\n📞 Uploading test contacts...');

        for (const contact of TEST_CONTACTS) {
            try {
                // Insert contact directly into database
                const result = await query(`
                    INSERT INTO contacts (
                        organization_id, campaign_id, first_name, last_name,
                        phone, email, company, title, status, priority
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id
                `, [
                    organizationId,
                    campaignId,
                    contact.first_name,
                    contact.last_name,
                    contact.phone,
                    contact.email,
                    contact.company,
                    contact.title,
                    'pending', // Set to pending so they can be picked up by the queue
                    1 // Priority
                ]);

                contactIds.push(result.rows[0].id);
                console.log(`   ✓ Added ${contact.first_name} ${contact.last_name} (${contact.phone})`);
            } catch (err) {
                console.error(`   ✗ Failed to add ${contact.first_name} ${contact.last_name}:`, err.message);
            }
        }

        console.log(`✅ ${contactIds.length} contacts uploaded successfully`);
        return contactIds.length > 0;
    } catch (error) {
        console.error('❌ Contact upload error:', error.message);
        return false;
    }
}

// Update campaign to active status
async function activateCampaign() {
    try {
        console.log('\n🚀 Activating campaign...');
        const response = await axios.put(
            `${API_BASE_URL}/campaigns/${campaignId}`,
            {
                status: 'active'
            },
            {
                headers: {
                    Authorization: `Bearer ${authToken}`
                }
            }
        );

        if (response.data.success) {
            console.log('✅ Campaign activated successfully');
            return true;
        } else {
            console.error('❌ Campaign activation failed:', response.data.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Campaign activation error:', error.response?.data || error.message);
        return false;
    }
}

// Start automated calls
async function startAutomatedCalls() {
    try {
        console.log('\n🤖 Starting automated calls...');
        const response = await axios.post(
            `${API_BASE_URL}/calls/automated/start`,
            {
                campaignId: campaignId
            },
            {
                headers: {
                    Authorization: `Bearer ${authToken}`
                }
            }
        );

        if (response.data.success) {
            console.log('✅ Automated calls started successfully');
            console.log('   Calls will be made every 30 seconds');
            console.log('   Maximum 3 concurrent calls');
            return true;
        } else {
            console.error('❌ Failed to start automated calls:', response.data.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Automated calls start error:', error.response?.data || error.message);
        return false;
    }
}

// Monitor queue status
async function monitorQueueStatus() {
    try {
        console.log('\n📊 Queue Status:');
        const response = await axios.get(
            `${API_BASE_URL}/calls/queue/status/${campaignId}`,
            {
                headers: {
                    Authorization: `Bearer ${authToken}`
                }
            }
        );

        if (response.data.success && response.data.status) {
            const status = response.data.status;
            console.log(`   Status: ${status.status}`);
            console.log(`   Total Contacts: ${status.totalContacts}`);
            console.log(`   Processed: ${status.processedContacts}`);
            console.log(`   Successful: ${status.successfulCalls}`);
            console.log(`   Failed: ${status.failedCalls}`);
            if (status.lastCallTime) {
                console.log(`   Last Call: ${new Date(status.lastCallTime).toLocaleTimeString()}`);
            }
            if (status.nextCallTime) {
                console.log(`   Next Call: ${new Date(status.nextCallTime).toLocaleTimeString()}`);
            }
            return status;
        } else {
            console.log('   Queue is not running or no status available');
            return null;
        }
    } catch (error) {
        console.error('❌ Queue status error:', error.response?.data || error.message);
        return null;
    }
}

// Monitor call history
async function monitorCallHistory() {
    try {
        const response = await axios.get(
            `${API_BASE_URL}/calls?campaign_id=${campaignId}`,
            {
                headers: {
                    Authorization: `Bearer ${authToken}`
                }
            }
        );

        if (response.data.success && response.data.calls) {
            console.log('\n📞 Call History:');
            response.data.calls.forEach(call => {
                console.log(`   ${call.contactName} (${call.phone})`);
                console.log(`      Status: ${call.status}`);
                console.log(`      Outcome: ${call.outcome || 'N/A'}`);
                console.log(`      Duration: ${call.duration || 0}s`);
                if (call.transcript) {
                    console.log(`      Transcript: ${call.transcript.substring(0, 100)}...`);
                }
                console.log(`      Created: ${new Date(call.createdAt).toLocaleString()}`);
                console.log('');
            });
            return response.data.calls;
        }
        return [];
    } catch (error) {
        console.error('❌ Call history error:', error.response?.data || error.message);
        return [];
    }
}

// Check Telnyx configuration
async function checkTelnyxConfig() {
    console.log('\n🔍 Checking Telnyx Configuration:');
    console.log(`   Username: ${process.env.TELNYX_SIP_USERNAME || 'NOT SET'}`);
    console.log(`   Domain: ${process.env.TELNYX_DOMAIN || 'NOT SET'}`);

    console.log(`   Caller ID: ${process.env.TELNYX_CALLER_ID || 'NOT SET'}`);

    if ( !process.env.TELNYX_SIP_USERNAME || !process.env.TELNYX_SIP_PASSWORD) {
        console.error('\n❌ Telnyx credentials not configured!');
        console.error('   Please set TELNYX_USERNAME and TELNYX_PASSWORD in your environment');
        return false;
    }

    console.log('✅ Telnyx configuration looks good');
    return true;
}

// Main execution
async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🤖 AI Dialer - Automated Calls Test with Telnyx');
    console.log('═══════════════════════════════════════════════════════\n');

    // Check Telnyx config
    const telnyxOk = await checkTelnyxConfig();
    if (!telnyxOk) {
        console.log('\n⚠️  Warning: Telnyx may not be configured properly');
        console.log('   Continuing anyway...\n');
    }

    // Step 1: Login
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.error('\n❌ Test failed: Unable to login');
        process.exit(1);
    }

    // Step 2: Create campaign
    const campaignSuccess = await createCampaign();
    if (!campaignSuccess) {
        console.error('\n❌ Test failed: Unable to create campaign');
        process.exit(1);
    }

    // Step 3: Upload contacts
    const contactsSuccess = await uploadContacts();
    if (!contactsSuccess) {
        console.error('\n❌ Test failed: Unable to upload contacts');
        process.exit(1);
    }

    // Step 4: Activate campaign
    const activateSuccess = await activateCampaign();
    if (!activateSuccess) {
        console.error('\n❌ Test failed: Unable to activate campaign');
        process.exit(1);
    }

    // Step 5: Start automated calls
    const startSuccess = await startAutomatedCalls();
    if (!startSuccess) {
        console.error('\n❌ Test failed: Unable to start automated calls');
        process.exit(1);
    }

    // Step 6: Monitor the queue
    console.log('\n🔄 Monitoring calls for 2 minutes...');
    console.log('   Press Ctrl+C to stop monitoring\n');

    const monitorInterval = setInterval(async () => {
        await monitorQueueStatus();
        await monitorCallHistory();
    }, 15000); // Check every 15 seconds

    // Initial check
    await monitorQueueStatus();

    // Monitor for 2 minutes
    setTimeout(async () => {
        clearInterval(monitorInterval);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('📊 Final Report');
        console.log('═══════════════════════════════════════════════════════\n');

        await monitorQueueStatus();
        const calls = await monitorCallHistory();

        console.log(`\n✅ Test completed!`);
        console.log(`   Campaign ID: ${campaignId}`);
        console.log(`   Total contacts: ${contactIds.length}`);
        console.log(`   Total calls initiated: ${calls.length}`);
        console.log(`\nTo view more details:`);
        console.log(`   - Open the dashboard: http://localhost:3001/campaigns/${campaignId}`);
        console.log(`   - Check call history: http://localhost:3001/calls?campaign=${campaignId}`);
        console.log(`\nTo stop automated calls:`);
        console.log(`   curl -X POST ${API_BASE_URL}/calls/automated/stop \\`);
        console.log(`        -H "Authorization: Bearer ${authToken}" \\`);
        console.log(`        -H "Content-Type: application/json" \\`);
        console.log(`        -d '{"campaignId": "${campaignId}"}'`);

        process.exit(0);
    }, 120000); // 2 minutes
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});

// Run the test
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
