const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const conversationSchema = Joi.object({
    call_id: Joi.string().uuid().required(),
    user_input: Joi.string().min(1).max(1000).required(),
    context: Joi.object().optional()
});

// Process conversation turn
router.post('/process', async(req, res) => {
    try {
        const { error, value } = conversationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { call_id, user_input, context = {} } = value;

        // Get call details and conversation history
        const callResult = await query(`
            SELECT c.*, ct.first_name, ct.last_name, ct.company, cp.name as campaign_name
            FROM calls c
            JOIN contacts ct ON c.contact_id = ct.id
            JOIN campaigns cp ON c.campaign_id = cp.id
            WHERE c.id = $1 AND c.organization_id = $2
        `, [call_id, req.organizationId]);

        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        const call = callResult.rows[0];

        // Get conversation history
        const historyResult = await query(`
            SELECT event_data
            FROM call_events
            WHERE call_id = $1 AND event_type = 'ai_conversation'
            ORDER BY timestamp DESC
            LIMIT 10
        `, [call_id]);

        const conversationHistory = historyResult.rows.map(row => row.event_data);

        // Get active scripts for this campaign
        const scriptsResult = await query(`
            SELECT type, content, variables, confidence_threshold
            FROM scripts
            WHERE organization_id = $1 AND is_active = true
            ORDER BY type, created_at DESC
        `, [req.organizationId]);

        const scripts = {};
        scriptsResult.rows.forEach(script => {
            if (!scripts[script.type]) {
                scripts[script.type] = {
                    content: script.content,
                    variables: script.variables,
                    confidence_threshold: script.confidence_threshold
                };
            }
        });

        // Query knowledge base for FAQ answers
        const keywords = user_input.toLowerCase().split(' ').filter(word => word.length > 2);
        const knowledgeResult = await query(`
            SELECT question, answer, confidence, category
            FROM knowledge_base
            WHERE organization_id = $1 AND is_active = true
            AND (
                LOWER(question) LIKE ANY($2) OR
                LOWER(answer) LIKE ANY($3)
            )
            ORDER BY confidence DESC
            LIMIT 5
        `, [
            req.organizationId,
            keywords.map(k => `%${k}%`),
            keywords.map(k => `%${k}%`)
        ]);

        // Analyze user intent and emotion
        const intentAnalysis = analyzeIntent(user_input, conversationHistory);
        const emotionAnalysis = analyzeEmotion(user_input, context);

        // Determine response strategy
        let response = {
            success: true,
            answer: "I don't have information about that topic. Let me connect you with a human representative.",
            confidence: 0,
            should_fallback: true,
            intent: intentAnalysis.intent,
            emotion: emotionAnalysis.emotion,
            suggested_actions: [],
            script_references: []
        };

        // Check for FAQ matches
        if (knowledgeResult.rows.length > 0) {
            const bestMatch = knowledgeResult.rows[0];
            response.answer = bestMatch.answer;
            response.confidence = parseFloat(bestMatch.confidence);
            response.should_fallback = parseFloat(bestMatch.confidence) < 0.7;
            response.category = bestMatch.category;
        }

        // Check for objection handling
        if (intentAnalysis.isObjection) {
            const objectionScript = scripts['objection_handling'];
            if (objectionScript) {
                response.answer = objectionScript.content;
                response.confidence = 0.8;
                response.should_fallback = false;
                response.script_references.push('objection_handling');
            }
        }

        // Check for closing opportunities
        if (intentAnalysis.isClosingOpportunity) {
            const closingScript = scripts['closing'];
            if (closingScript) {
                response.answer = closingScript.content;
                response.confidence = 0.9;
                response.should_fallback = false;
                response.script_references.push('closing');
                response.suggested_actions.push('schedule_meeting');
            }
        }

        // Generate suggested actions based on context
        if (intentAnalysis.intent === 'pricing_inquiry') {
            response.suggested_actions.push('send_pricing_info');
        } else if (intentAnalysis.intent === 'demo_request') {
            response.suggested_actions.push('schedule_demo');
        } else if (intentAnalysis.intent === 'competitor_mention') {
            response.suggested_actions.push('competitive_analysis');
        }

        // Log conversation event
        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [call_id, 'ai_conversation', JSON.stringify({
            user_input: user_input,
            ai_response: response.answer,
            confidence: response.confidence,
            intent: response.intent,
            emotion: response.emotion,
            timestamp: new Date().toISOString(),
            context: context
        })]);

        res.json(response);

    } catch (error) {
        logger.error('Conversation processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process conversation'
        });
    }
});

// Get conversation history
router.get('/history/:call_id', async(req, res) => {
    try {
        const { call_id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const result = await query(`
            SELECT event_data, timestamp
            FROM call_events
            WHERE call_id = $1 AND event_type = 'ai_conversation'
            ORDER BY timestamp DESC
            LIMIT $2 OFFSET $3
        `, [call_id, parseInt(limit), parseInt(offset)]);

        const history = result.rows.map(row => ({
            ...row.event_data,
            timestamp: row.timestamp
        }));

        res.json({
            success: true,
            history,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: history.length
            }
        });

    } catch (error) {
        logger.error('Conversation history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conversation history'
        });
    }
});

// Helper functions
function analyzeIntent(userInput, conversationHistory) {
    const input = userInput.toLowerCase();

    // Objection patterns
    const objectionPatterns = [
        'too expensive', 'not interested', 'not right time', 'budget', 'cost',
        'competitor', 'already have', 'not sure', 'think about it', 'call back'
    ];

    // Closing opportunity patterns
    const closingPatterns = [
        'sounds good', 'interested', 'tell me more', 'how much', 'when can',
        'schedule', 'meeting', 'demo', 'trial', 'purchase'
    ];

    // Intent patterns
    const intentPatterns = {
        'pricing_inquiry': ['price', 'cost', 'how much', 'pricing', 'budget'],
        'demo_request': ['demo', 'show me', 'trial', 'test', 'see it'],
        'competitor_mention': ['competitor', 'alternative', 'other company', 'vs'],
        'technical_question': ['how does', 'technical', 'integration', 'api'],
        'timing_question': ['when', 'timeline', 'schedule', 'available']
    };

    let intent = 'general';
    let isObjection = false;
    let isClosingOpportunity = false;

    // Check for objections
    if (objectionPatterns.some(pattern => input.includes(pattern))) {
        isObjection = true;
        intent = 'objection';
    }

    // Check for closing opportunities
    if (closingPatterns.some(pattern => input.includes(pattern))) {
        isClosingOpportunity = true;
        intent = 'closing_opportunity';
    }

    // Check for specific intents
    for (const [intentType, patterns] of Object.entries(intentPatterns)) {
        if (patterns.some(pattern => input.includes(pattern))) {
            intent = intentType;
            break;
        }
    }

    return {
        intent,
        isObjection,
        isClosingOpportunity,
        confidence: 0.8
    };
}

function analyzeEmotion(userInput, context) {
    const input = userInput.toLowerCase();

    // Emotion patterns
    const emotionPatterns = {
        'positive': ['great', 'excellent', 'love', 'amazing', 'perfect', 'interested'],
        'negative': ['bad', 'terrible', 'hate', 'awful', 'disappointed', 'frustrated'],
        'neutral': ['okay', 'fine', 'alright', 'sure', 'maybe'],
        'confused': ['confused', 'don\'t understand', 'unclear', 'explain', 'what'],
        'urgent': ['urgent', 'asap', 'immediately', 'quickly', 'rush']
    };

    let emotion = 'neutral';
    let confidence = 0.5;

    for (const [emotionType, patterns] of Object.entries(emotionPatterns)) {
        const matches = patterns.filter(pattern => input.includes(pattern)).length;
        if (matches > 0) {
            emotion = emotionType;
            confidence = Math.min(0.9, 0.5 + (matches * 0.1));
            break;
        }
    }

    return {
        emotion,
        confidence
    };
}

module.exports = router;