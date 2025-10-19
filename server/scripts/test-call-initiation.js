const { startManualCall } = require('../services/telephony/providers/asterisk');

async function testCallInitiation() {
    console.log('Testing call initiation...');

    try {
        const testCall = {
            callId: 'test-call-' + Date.now(),
            agentExtension: '1001', // Replace with actual agent extension
            toPhone: '+1234567890', // Replace with test phone number
            contactId: 'test-contact-id'
        };

        console.log('Initiating test call:', testCall);

        const result = await startManualCall(testCall);

        console.log('Call initiation result:', result);

        if (result.success) {
            console.log('✅ Call initiated successfully');
        } else {
            console.log('❌ Call initiation failed');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testCallInitiation();
