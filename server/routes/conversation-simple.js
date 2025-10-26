const express = require('express');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * SIMPLIFIED Conversation Processing
 *
 * NO emotion analysis, NO warm transfers, NO complex AI
 * Just intelligent script-based conversation management
 */

// Simple conversation processor
router.post('/simple-process', async (req, res) => {
    try {
        const { call_id, user_input, turn } = req.body;

        if (!call_id || !user_input) {
            return res.status(400).json({
                success: false,
                message: 'Call ID and user input required'
            });
        }

        logger.info(`Processing conversation - Call: ${call_id}, Turn: ${turn}`);

        // Get call and contact info
        const callResult = await query(`
            SELECT c.*, ct.first_name, ct.last_name, ct.company,
                   cp.name as campaign_name, c.organization_id
            FROM calls c
            JOIN contacts ct ON c.contact_id = ct.id
            JOIN campaigns cp ON c.campaign_id = cp.id
            WHERE c.id = $1
        `, [call_id]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = callResult.rows[0];

        // Get conversation script
        const scriptResult = await query(`
            SELECT content, variables
            FROM scripts
            WHERE organization_id = $1 AND type = 'main_pitch' AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        `, [call.organization_id]);

        let script_content = '';
        if (scriptResult.rows.length > 0) {
            script_content = scriptResult.rows[0].content;

            // Replace variables
            script_content = script_content
                .replace(/\{first_name\}/g, call.first_name || 'there')
                .replace(/\{last_name\}/g, call.last_name || '')
                .replace(/\{company\}/g, call.company || 'your company');
        }

        // Analyze user input with simple keyword detection
        const analysis = analyzeCustomerResponse(user_input.toLowerCase());

        // Log conversation turn
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, 'ai_conversation', $2)
        `, [call_id, JSON.stringify({
            turn,
            user_input,
            intent: analysis.intent,
            timestamp: new Date().toISOString()
        })]);

        // Generate intelligent response based on intent
        let ai_response = '';
        let should_continue = true;
        let action = 'continue';

        switch (analysis.intent) {
            case 'interested':
                ai_response = "That's great to hear! Let me tell you more about how we can help you. " +
                             (script_content ? script_content.split('.').slice(1, 3).join('.') : '');
                action = 'continue';
                break;

            case 'not_interested':
                ai_response = "I understand. Thank you for your time. Have a great day!";
                should_continue = false;
                action = 'end_call';

                // Update call outcome
                await query(`
                    UPDATE calls SET outcome = 'not_interested' WHERE id = $1
                `, [call_id]);
                break;

            case 'question':
                // Query knowledge base for answer
                const answer = await getKnowledgeAnswer(user_input, call.organization_id);
                ai_response = answer || "That's a great question. Let me connect you with someone who can help you better. Can I schedule a callback?";
                break;

            case 'callback':
                ai_response = "Perfect! Someone from our team will call you back within 24 hours. Thank you!";
                should_continue = false;
                action = 'schedule_callback';

                await query(`
                    UPDATE calls SET outcome = 'callback' WHERE id = $1
                `, [call_id]);
                break;

            case 'dnc':
                ai_response = "I understand. I'll make sure you're removed from our calling list. Apologies for any inconvenience.";
                should_continue = false;
                action = 'dnc';

                // Add to DNC list
                await query(`
                    INSERT INTO dnc_registry (organization_id, phone, reason, source)
                    VALUES ($1, $2, 'Customer request', 'automated_call')
                    ON CONFLICT (organization_id, phone) DO NOTHING
                `, [call.organization_id, call.to_number]);

                await query(`
                    UPDATE calls SET outcome = 'dnc_request' WHERE id = $1
                `, [call_id]);
                break;

            case 'positive':
                ai_response = "Wonderful! " + (script_content ? script_content.split('.').slice(2, 4).join('.') : 'Let me share more details with you.');
                break;

            case 'negative':
                ai_response = "I understand your concern. Many of our customers felt the same way initially. Can I share how we addressed similar concerns?";
                break;

            default:
                // Neutral - continue with script
                ai_response = script_content ? script_content.split('.').slice(1, 3).join('.') : "Thank you for that. Let me continue...";
                break;
        }

        // Log AI response (update the conversation event with AI response)
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, 'ai_conversation', $2)
        `, [call_id, JSON.stringify({
            turn,
            user_input,
            ai_response,
            intent: analysis.intent,
            action,
            timestamp: new Date().toISOString()
        })]);

        res.json({
            success: true,
            ai_response,
            should_continue,
            action,
            intent: analysis.intent
        });

    } catch (error) {
        logger.error('Simple conversation processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process conversation'
        });
    }
});

/**
 * Analyze customer response with simple keyword detection
 */
function analyzeCustomerResponse(input) {
    const patterns = {
        interested: /(interested|yes|sure|okay|tell me more|sounds good|i want|sign me up)/i,
        not_interested: /(not interested|no thanks|remove me|stop calling|don't call|not now|busy)/i,
        question: /(how|what|why|when|where|can you|do you|is it|will it|does it)/i,
        callback: /(call back|later|another time|different time|not now|busy)/i,
        dnc: /(remove|stop calling|do not call|take me off|unsubscribe|dnc)/i,
        positive: /(great|excellent|perfect|wonderful|amazing|love it|fantastic)/i,
        negative: /(expensive|too much|can't afford|not right now|maybe later)/i
    };

    for (const [intent, pattern] of Object.entries(patterns)) {
        if (pattern.test(input)) {
            return { intent, confidence: 0.8 };
        }
    }

    return { intent: 'neutral', confidence: 0.5 };
}

/**
 * Get answer from knowledge base
 */
async function getKnowledgeAnswer(question, organizationId) {
    try {
        const keywords = question.toLowerCase().split(' ').filter(w => w.length > 3);

        if (keywords.length === 0) return null;

        const result = await query(`
            SELECT answer
            FROM knowledge_entries
            WHERE organization_id = $1 AND is_active = true
            AND (
                LOWER(question) LIKE ANY($2) OR
                LOWER(answer) LIKE ANY($3)
            )
            ORDER BY confidence DESC
            LIMIT 1
        `, [
            organizationId,
            keywords.map(k => `%${k}%`),
            keywords.map(k => `%${k}%`)
        ]);

        return result.rows.length > 0 ? result.rows[0].answer : null;

    } catch (error) {
        logger.error('Knowledge base query error:', error);
        return null;
    }
}

module.exports = router;
