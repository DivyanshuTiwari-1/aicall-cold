const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to handle organization ID for AGI scripts
router.use(async (req, res, next) => {
    if (!req.organizationId) {
        const call_id = req.body?.call_id || req.query?.call_id || req.params?.call_id;
        if (call_id) {
            try {
                const result = await query('SELECT organization_id FROM calls WHERE id = $1', [call_id]);
                if (result.rows.length > 0) {
                    req.organizationId = result.rows[0].organization_id;
                } else {
                    const orgResult = await query('SELECT id FROM organizations LIMIT 1');
                    req.organizationId = orgResult.rows[0]?.id || 'default-org';
                }
            } catch (error) {
                logger.warn('Could not lookup organization_id:', error.message);
                try {
                    const orgResult = await query('SELECT id FROM organizations LIMIT 1');
                    req.organizationId = orgResult.rows[0]?.id || 'default-org';
                } catch (orgError) {
                    req.organizationId = 'default-org';
                }
            }
        } else {
            try {
                const orgResult = await query('SELECT id FROM organizations LIMIT 1');
                req.organizationId = orgResult.rows[0]?.id || 'default-org';
            } catch (error) {
                req.organizationId = 'default-org';
            }
        }
    }
    next();
});

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
            WHERE c.id = $1
        `, [call_id]);

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
            FROM knowledge_entries
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

        // Analyze user intent and emotion using enhanced engine
        const intentAnalysis = conversationEngine.analyzeIntent(user_input, conversationHistory);
        const emotionAnalysis = conversationEngine.analyzeEmotion(user_input, context);

        // Generate response using enhanced engine
        let response = conversationEngine.generateResponse(intentAnalysis, emotionAnalysis, scripts, knowledgeResult.rows);

        // Check for FAQ matches and override if better match found
        if (knowledgeResult.rows.length > 0) {
            const bestMatch = knowledgeResult.rows[0];
            const knowledgeConfidence = parseFloat(bestMatch.confidence);

            // Use knowledge base answer if it has higher confidence
            if (knowledgeConfidence > response.confidence) {
                response.answer = bestMatch.answer;
                response.confidence = knowledgeConfidence;
                response.should_fallback = knowledgeConfidence < 0.5;
                response.category = bestMatch.category;
                response.source = 'knowledge_base';
            }
        }

        // Add contact personalization
        if (call.first_name) {
            // Replace generic greetings with personalized ones
            response.answer = response.answer.replace(/\bHello\b/g, `Hello ${call.first_name}`);
            response.answer = response.answer.replace(/\bHi\b/g, `Hi ${call.first_name}`);
        }

        // Ensure minimum response quality
        if (response.confidence < 0.3 && !response.should_fallback) {
            response.should_fallback = true;
            response.suggested_actions = response.suggested_actions || [];
            response.suggested_actions.push('transfer_to_human');
        }

        // Handle frustrated or angry emotions
        if (emotionAnalysis.emotion === 'frustrated' || emotionAnalysis.emotion === 'angry') {
            response.suggested_actions = response.suggested_actions || [];
            response.suggested_actions.push('transfer_to_human');
            const name = call.first_name || '';
            response.answer = `I understand this is important to you${name ? ', ' + name : ''}. Let me connect you with someone who can help right away.`;
            response.should_fallback = true;
        }

        // Check for DNC request keywords
        const dncKeywords = ['stop calling', 'don\'t call', 'do not call', 'remove me', 'take me off', 'unsubscribe', 'stop contacting'];
        const userInputLower = user_input.toLowerCase();
        const hasDNCRequest = dncKeywords.some(keyword => userInputLower.includes(keyword));

        if (hasDNCRequest || (emotionAnalysis.action === 'apologize_and_exit')) {
            // Add contact to DNC list
            try {
                // Get contact phone from call
                const contactResult = await query(
                    'SELECT phone FROM contacts WHERE id = $1',
                    [call.contact_id]
                );

                if (contactResult.rows.length > 0) {
                    const contactPhone = contactResult.rows[0].phone;

                    // Check if not already on DNC list
                    const dncCheck = await query(
                        'SELECT id FROM dnc_registry WHERE organization_id = $1 AND phone = $2',
                        [req.organizationId, contactPhone]
                    );

                    if (dncCheck.rows.length === 0) {
                        // Add to DNC list
                        await query(`
                            INSERT INTO dnc_registry (organization_id, phone, reason, source, added_by)
                            VALUES ($1, $2, $3, $4, NULL)
                        `, [req.organizationId, contactPhone, 'user_request', 'api']);

                        // Update contact status
                        await query(
                            'UPDATE contacts SET status = $1 WHERE id = $2',
                            ['dnc', call.contact_id]
                        );

                        // Log compliance audit
                        await query(`
                            INSERT INTO compliance_audit_logs (organization_id, event_type, event_data, user_id)
                            VALUES ($1, $2, $3, NULL)
                        `, [
                            req.organizationId,
                            'dnc_added',
                            JSON.stringify({
                                phone: contactPhone,
                                reason: 'user_request',
                                source: 'ai_conversation',
                                call_id: call_id
                            })
                        ]);

                        logger.info(`Contact ${call.contact_id} (${contactPhone}) added to DNC list via AI conversation`);
                    }
                }
            } catch (dncError) {
                logger.error('Error adding contact to DNC:', dncError);
            }

            response.suggested_actions = response.suggested_actions || [];
            response.suggested_actions.push('end_call', 'added_to_dnc');
        }

        // Add company context if available
        if (call.company) {
            response.answer = response.answer.replace(/your company/gi, call.company);
        }

        // Add real-time objection handling suggestions
        if (intentAnalysis.isObjection) {
            response.objection_handling = {
                type: intentAnalysis.objectionType,
                suggested_responses: (intentAnalysis.handler && intentAnalysis.handler.responses) ? intentAnalysis.handler.responses : [],
                follow_up_action: (intentAnalysis.handler && intentAnalysis.handler.followUp) ? intentAnalysis.handler.followUp : 'escalate'
            };
        }

        // Add emotion-based actions
        if (emotionAnalysis.action) {
            response.emotion_action = emotionAnalysis.action;
        }

        // Add conversation context
        response.conversation_context = {
            turn_count: conversationHistory.length + 1,
            recent_topics: conversationHistory.slice(0, 3).map(turn => turn.intent || 'general'),
            emotion_trend: conversationHistory.slice(0, 5).map(turn => turn.emotion || 'neutral')
        };

        // Log conversation event
        const conversationEventData = {
            user_input: user_input,
            ai_response: response.answer,
            confidence: response.confidence,
            intent: response.intent,
            emotion: response.emotion,
            timestamp: new Date().toISOString(),
            context: context
        };

        await query(`
            INSERT INTO call_events (call_id, event_type, event_data)
            VALUES ($1, $2, $3)
        `, [call_id, 'ai_conversation', JSON.stringify(conversationEventData)]);

        // Broadcast conversation turn via WebSocket
        const WebSocketBroadcaster = require('../services/websocket-broadcaster');
        if (call.organization_id) {
            WebSocketBroadcaster.broadcastConversationTurn(
                call.organization_id,
                call_id,
                conversationEventData
            );
        }

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

// Get conversation context for live monitoring
router.get('/context/:call_id', async(req, res) => {
    try {
        const { call_id } = req.params;

        // Verify call exists (use organizationId from middleware if available)
        const callCheck = await query(
            'SELECT id, organization_id FROM calls WHERE id = $1',
            [call_id]
        );

        if (callCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Call not found'
            });
        }

        // Get all conversation events for this call
        const result = await query(`
            SELECT event_data, timestamp
            FROM call_events
            WHERE call_id = $1 AND event_type = 'ai_conversation'
            ORDER BY timestamp ASC
        `, [call_id]);

        // Format conversation history for frontend
        const history = result.rows.map((row, index) => {
            const data = row.event_data || {};
            return {
                user_input: data.user_input || null,
                ai_response: data.ai_response || null,
                timestamp: row.timestamp,
                turn: data.turn || (index + 1),
                confidence: data.confidence || null,
                emotion: data.emotion || null,
                intent: data.intent || null,
                type: data.type || 'conversation'
            };
        });

        res.json({
            success: true,
            history
        });

    } catch (error) {
        logger.error('Conversation context error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conversation context'
        });
    }
});

// Enhanced AI Conversation Engine
class ConversationEngine {
    constructor() {
        this.objectionHandlers = new Map();
        this.emotionDetectors = new Map();
        this.intentClassifiers = new Map();
        this.initializePatterns();
    }

    initializePatterns() {
        // Enhanced objection patterns with context
        this.objectionHandlers.set('price', {
            patterns: ['too expensive', 'cost too much', 'budget', 'price', 'expensive', 'cheaper'],
            responses: [
                "I understand cost is important. Our solution actually saves companies 30% on average compared to competitors. Would you like to see a cost comparison?",
                "Many of our clients initially thought the same, but they found the ROI pays for itself within 3 months. Can I show you how?",
                "What budget range were you thinking? I can customize a solution that fits your needs."
            ],
            followUp: 'pricing_justification'
        });

        this.objectionHandlers.set('timing', {
            patterns: ['not right time', 'busy', 'later', 'next quarter', 'not now'],
            responses: [
                "I completely understand. When would be a better time to discuss this? I can schedule a quick 15-minute call.",
                "What's keeping you busy right now? Maybe our solution could help with that.",
                "I respect your time. Would 5 minutes be okay to show you how this could save you time?"
            ],
            followUp: 'reschedule'
        });

        this.objectionHandlers.set('competitor', {
            patterns: ['competitor', 'already have', 'using', 'alternative', 'other company'],
            responses: [
                "That's great! What do you like most about your current solution? I'd love to show you how we compare.",
                "Many of our clients switched from [competitor]. What's your biggest challenge with them?",
                "I'd love to show you a side-by-side comparison. What features are most important to you?"
            ],
            followUp: 'competitive_analysis'
        });

        // Enhanced emotion detection
        this.emotionDetectors.set('interested', {
            patterns: ['tell me more', 'interesting', 'how does', 'show me', 'demo', 'trial'],
            confidence: 0.9,
            action: 'provide_demo'
        });

        this.emotionDetectors.set('skeptical', {
            patterns: ['not sure', 'doubt', 'sounds too good', 'really', 'prove it'],
            confidence: 0.8,
            action: 'provide_proof'
        });

        this.emotionDetectors.set('frustrated', {
            patterns: ['frustrated', 'annoying', 'waste of time', 'stop calling'],
            confidence: 0.9,
            action: 'apologize_and_exit'
        });

        // Intent classification with confidence scoring
        this.intentClassifiers.set('buying_signals', {
            patterns: ['purchase', 'buy', 'order', 'sign up', 'get started', 'proceed'],
            confidence: 0.95,
            action: 'closing_sequence'
        });

        this.intentClassifiers.set('information_gathering', {
            patterns: ['what', 'how', 'when', 'where', 'why', 'explain', 'details'],
            confidence: 0.8,
            action: 'provide_information'
        });
    }

    analyzeIntent(userInput, conversationHistory) {
        const input = userInput.toLowerCase();
        let bestMatch = { intent: 'general', confidence: 0.3, isObjection: false, isClosingOpportunity: false };

        // Check for objections first
        for (const [objectionType, handler] of this.objectionHandlers) {
            const matches = handler.patterns.filter(pattern => input.includes(pattern)).length;
            if (matches > 0) {
                bestMatch = {
                    intent: 'objection',
                    objectionType: objectionType,
                    confidence: Math.min(0.95, 0.7 + (matches * 0.1)),
                    isObjection: true,
                    isClosingOpportunity: false,
                    handler: handler
                };
                break;
            }
        }

        // Check for buying signals
        for (const [intentType, classifier] of this.intentClassifiers) {
            const matches = classifier.patterns.filter(pattern => input.includes(pattern)).length;
            if (matches > 0 && classifier.confidence > bestMatch.confidence) {
                bestMatch = {
                    intent: intentType,
                    confidence: classifier.confidence,
                    isObjection: false,
                    isClosingOpportunity: intentType === 'buying_signals',
                    action: classifier.action
                };
            }
        }

        // Check conversation history for context
        if (conversationHistory.length > 0) {
            const recentContext = conversationHistory.slice(0, 3);
            const contextBoost = this.analyzeContext(recentContext, input);
            bestMatch.confidence = Math.min(0.95, bestMatch.confidence + contextBoost);
        }

        return bestMatch;
    }

    analyzeEmotion(userInput, context) {
        const input = userInput.toLowerCase();
        let bestMatch = { emotion: 'neutral', confidence: 0.5 };

        for (const [emotionType, detector] of this.emotionDetectors) {
            const matches = detector.patterns.filter(pattern => input.includes(pattern)).length;
            if (matches > 0 && detector.confidence > bestMatch.confidence) {
                bestMatch = {
                    emotion: emotionType,
                    confidence: detector.confidence,
                    action: detector.action
                };
            }
        }

        // Analyze tone indicators
        const toneIndicators = {
            'excited': ['!', 'amazing', 'fantastic', 'love it'],
            'concerned': ['worried', 'concerned', 'issue', 'problem'],
            'confused': ['?', 'confused', 'unclear', 'don\'t understand']
        };

        for (const [tone, indicators] of Object.entries(toneIndicators)) {
            if (indicators.some(indicator => input.includes(indicator))) {
                bestMatch.tone = tone;
                bestMatch.confidence = Math.min(0.95, bestMatch.confidence + 0.2);
            }
        }

        return bestMatch;
    }

    analyzeContext(conversationHistory, currentInput) {
        let contextBoost = 0;

        // Check for repeated topics
        const topics = conversationHistory.map(turn => (turn.user_input || '').toLowerCase());
        const currentTopics = currentInput.toLowerCase().split(' ');

        const topicOverlap = currentTopics.filter(topic =>
            topics.some(history => history.includes(topic))
        ).length;

        if (topicOverlap > 0) {
            contextBoost += topicOverlap * 0.1;
        }

        // Check for escalation patterns
        const recentEmotions = conversationHistory.map(turn => turn.emotion || 'neutral');
        if (recentEmotions.includes('frustrated') || recentEmotions.includes('negative')) {
            contextBoost += 0.2;
        }

        return Math.min(0.3, contextBoost);
    }

    generateResponse(intentAnalysis, emotionAnalysis, scripts, knowledgeBase) {
        let response = {
            success: true,
            answer: "I understand. Let me connect you with a human representative who can better assist you.",
            confidence: 0.3,
            should_fallback: true,
            intent: intentAnalysis.intent,
            emotion: emotionAnalysis.emotion,
            suggested_actions: [],
            script_references: [],
            objection_type: intentAnalysis.objectionType
        };

        // Handle objections with specific responses
        if (intentAnalysis.isObjection && intentAnalysis.handler) {
            const handler = intentAnalysis.handler;
            response.answer = handler.responses[Math.floor(Math.random() * handler.responses.length)];
            response.confidence = intentAnalysis.confidence;
            response.should_fallback = false;
            response.suggested_actions.push(handler.followUp);
            response.script_references.push('objection_handling');
        }

        // Handle buying signals
        if (intentAnalysis.isClosingOpportunity) {
            response.answer = "That's great! I'd love to get you set up. What's the best way to move forward?";
            response.confidence = 0.9;
            response.should_fallback = false;
            response.suggested_actions.push('schedule_meeting', 'send_proposal');
            response.script_references.push('closing');
        }

        // Handle specific emotions
        if (emotionAnalysis.action) {
            switch (emotionAnalysis.action) {
                case 'provide_demo':
                    response.answer = "I'd be happy to show you a quick demo. What would you like to see first?";
                    response.confidence = 0.8;
                    response.suggested_actions.push('schedule_demo');
                    break;
                case 'provide_proof':
                    response.answer = "I can provide case studies and testimonials from similar companies. Would that help?";
                    response.confidence = 0.7;
                    response.suggested_actions.push('send_case_studies');
                    break;
                case 'apologize_and_exit':
                    response.answer = "I apologize for any inconvenience. I'll remove you from our calling list right away. Have a great day!";
                    response.confidence = 0.95;
                    response.should_fallback = true;
                    response.suggested_actions.push('add_to_dnc', 'end_call');
                    break;
            }
        }

        return response;
    }
}

// Initialize conversation engine
const conversationEngine = new ConversationEngine();

// Helper functions (keeping original for backward compatibility)
function analyzeIntent(userInput, conversationHistory) {
    return conversationEngine.analyzeIntent(userInput, conversationHistory);
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
