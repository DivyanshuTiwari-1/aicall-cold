const { query } = require('../config/database');
const logger = require('../utils/logger');

// AI Analysis Service for Intent Detection, Emotion Analysis, and Auto-tagging

/**
 * Analyze call transcript for intent, emotion, and generate auto-tags
 * @param {string} callId - Call ID
 * @param {string} transcript - Call transcript
 * @returns {Object} Analysis results
 */
async function analyzeCallTranscript(callId, transcript) {
    try {
        logger.info(`Starting AI analysis for call ${callId}`);

        // 1. Intent Detection
        const intent = await detectIntent(transcript);

        // 2. Emotion Analysis with enhanced timeline
        const emotions = await analyzeEmotions(transcript);

        // Generate detailed emotion timeline with per-turn tracking
        const emotionTimeline = await generateEmotionTimeline(transcript, callId);
        emotions.timeline = emotionTimeline;

        // 3. Auto-tagging
        const autoTags = generateAutoTags(intent, emotions, transcript);

        // 4. Objection Detection
        const objections = detectObjections(transcript);

        // 5. Store analysis results
        await storeAnalysis(callId, {
            intent,
            emotions,
            autoTags,
            objections
        });

        // 6. Calculate agent empathy score if call has an agent
        const callResult = await query(`
            SELECT initiated_by FROM calls WHERE id = $1
        `, [callId]);

        if (callResult.rows.length > 0 && callResult.rows[0].initiated_by) {
            await calculateAgentEmpathyScore(callId, callResult.rows[0].initiated_by);
        }

        // 7. Trigger workflows if high intent detected
        if (intent.confidence > 0.8 && intent.label === 'demo_request') {
            await createFollowupTask(callId, intent);
        }

        // 8. Check for high intent and trigger warm transfer
        const warmTransferService = require('./warm-transfer');
        try {
            const transferResult = await warmTransferService.detectHighIntentAndTransfer(
                callId,
                transcript,
                { intent, emotions }
            );

            if (transferResult) {
                logger.info(`Warm transfer triggered for call ${callId}`, {
                    transferId: transferResult.id,
                    intentLabel: intent.label,
                    intentConfidence: intent.confidence
                });
            }
        } catch (error) {
            logger.error(`Error triggering warm transfer for call ${callId}:`, error);
            // Don't throw error to avoid breaking the analysis flow
        }

        // 9. Monitor emotional state and trigger alerts
        const emotionalAlertsService = require('./emotional-alerts');
        try {
            const alertResult = await emotionalAlertsService.monitorEmotionalState(
                callId,
                emotions.timeline,
                emotions
            );

            if (alertResult) {
                logger.info(`Emotional alert triggered for call ${callId}`, {
                    alertId: alertResult.id,
                    alertType: alertResult.alert_type,
                    emotion: alertResult.emotion
                });
            }
        } catch (error) {
            logger.error(`Error monitoring emotional state for call ${callId}:`, error);
            // Don't throw error to avoid breaking the analysis flow
        }

        logger.info(`AI analysis completed for call ${callId}`);

        return {
            intent,
            emotions,
            autoTags,
            objections
        };

    } catch (error) {
        logger.error(`AI analysis error for call ${callId}:`, error);
        throw error;
    }
}

/**
 * Detect intent from transcript using OpenAI or local model
 * @param {string} transcript - Call transcript
 * @returns {Object} Intent analysis
 */
async function detectIntent(transcript) {
    try {
        // For now, using a simple rule-based approach
        // In production, integrate with OpenAI GPT-4 or local model

        const intentKeywords = {
            'demo_request': ['demo', 'trial', 'test', 'try', 'show me', 'demonstration'],
            'pricing_inquiry': ['price', 'cost', 'pricing', 'how much', 'budget', 'expensive'],
            'interested': ['interested', 'sounds good', 'tell me more', 'yes', 'sure'],
            'not_interested': ['not interested', 'no thanks', 'not now', 'busy', 'not right time'],
            'callback_request': ['call back', 'call me back', 'later', 'another time'],
            'objection_budget': ['too expensive', 'budget', 'cost', 'price'],
            'objection_timeline': ['not now', 'later', 'next year', 'timing'],
            'objection_authority': ['need to check', 'boss', 'manager', 'decision maker']
        };

        const transcriptLower = transcript.toLowerCase();
        let maxConfidence = 0;
        let detectedIntent = 'neutral';
        let confidence = 0.5;

        for (const [intent, keywords] of Object.entries(intentKeywords)) {
            let matchCount = 0;
            for (const keyword of keywords) {
                if (transcriptLower.includes(keyword)) {
                    matchCount++;
                }
            }

            const intentConfidence = Math.min(matchCount / keywords.length, 1.0);
            if (intentConfidence > maxConfidence) {
                maxConfidence = intentConfidence;
                detectedIntent = intent;
                confidence = Math.max(intentConfidence, 0.6);
            }
        }

        return {
            label: detectedIntent,
            confidence: confidence,
            keywords: Object.keys(intentKeywords[detectedIntent] || {}),
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        logger.error('Intent detection error:', error);
        return {
            label: 'unknown',
            confidence: 0.0,
            keywords: [],
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Analyze emotions from transcript
 * @param {string} transcript - Call transcript
 * @returns {Object} Emotion analysis
 */
async function analyzeEmotions(transcript) {
    try {
        // Simple emotion detection based on keywords
        // In production, integrate with Hume AI or similar service

        const emotionKeywords = {
            'positive': ['great', 'excellent', 'amazing', 'wonderful', 'perfect', 'love', 'fantastic'],
            'negative': ['terrible', 'awful', 'hate', 'disappointed', 'frustrated', 'angry', 'upset'],
            'neutral': ['okay', 'fine', 'alright', 'sure', 'maybe'],
            'curious': ['interesting', 'tell me more', 'how does', 'what about', 'explain'],
            'confused': ['confused', 'don\'t understand', 'unclear', 'not sure', 'what do you mean'],
            'frustrated': ['frustrated', 'annoyed', 'irritated', 'fed up', 'enough'],
            'excited': ['excited', 'thrilled', 'can\'t wait', 'looking forward', 'awesome']
        };

        const transcriptLower = transcript.toLowerCase();
        const emotionScores = {};

        for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
            let score = 0;
            for (const keyword of keywords) {
                const matches = (transcriptLower.match(new RegExp(keyword, 'g')) || []).length;
                score += matches;
            }
            emotionScores[emotion] = score;
        }

        // Find dominant emotion
        const dominantEmotion = Object.keys(emotionScores).reduce((a, b) =>
            emotionScores[a] > emotionScores[b] ? a : b
        );

        const totalScore = Object.values(emotionScores).reduce((a, b) => a + b, 0);
        const intensity = totalScore > 0 ? Math.min(totalScore / 10, 1.0) : 0.1;

        // Calculate enhanced volatility with sustained emotion detection
        const volatility = calculateEmotionVolatility(transcript);

        return {
            dominant: dominantEmotion,
            intensity: intensity,
            volatility: volatility,
            scores: emotionScores,
            timeline: generateEmotionTimeline(transcript),
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        logger.error('Emotion analysis error:', error);
        return {
            dominant: 'neutral',
            intensity: 0.1,
            volatility: 0.0,
            scores: {},
            timeline: [],
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Generate auto-tags based on intent and emotions
 * @param {Object} intent - Intent analysis
 * @param {Object} emotions - Emotion analysis
 * @param {string} transcript - Call transcript
 * @returns {Array} Auto-generated tags
 */
function generateAutoTags(intent, emotions, transcript) {
    const tags = [];

    // Intent-based tags
    if (intent.label === 'demo_request') {
        tags.push('demo_request');
    }
    if (intent.label === 'pricing_inquiry') {
        tags.push('pricing_inquiry');
    }
    if (intent.label.includes('objection_')) {
        tags.push('objection_raised');
        tags.push(intent.label);
    }

    // Emotion-based tags
    if (emotions.dominant === 'positive') {
        tags.push('positive_response');
    }
    if (emotions.dominant === 'negative') {
        tags.push('negative_response');
    }
    if (emotions.intensity > 0.7) {
        tags.push('high_emotion');
    }

    // Transcript-based tags
    const transcriptLower = transcript.toLowerCase();

    if (transcriptLower.includes('competitor') || transcriptLower.includes('alternative')) {
        tags.push('competitor_mentioned');
    }
    if (transcriptLower.includes('urgent') || transcriptLower.includes('asap')) {
        tags.push('urgent');
    }
    if (transcriptLower.includes('decision maker') || transcriptLower.includes('boss')) {
        tags.push('authority_issue');
    }
    if (transcriptLower.includes('budget') || transcriptLower.includes('cost')) {
        tags.push('budget_discussion');
    }

    return [...new Set(tags)]; // Remove duplicates
}

/**
 * Detect objections in transcript
 * @param {string} transcript - Call transcript
 * @returns {Array} Detected objections
 */
function detectObjections(transcript) {
    const objections = [];
    const transcriptLower = transcript.toLowerCase();

    const objectionPatterns = {
        'pricing': {
            keywords: ['too expensive', 'cost', 'price', 'budget', 'afford'],
            severity: 'high'
        },
        'timeline': {
            keywords: ['not now', 'later', 'next year', 'timing', 'busy'],
            severity: 'medium'
        },
        'authority': {
            keywords: ['need to check', 'boss', 'manager', 'decision maker', 'team'],
            severity: 'medium'
        },
        'product_fit': {
            keywords: ['not for us', 'doesn\'t fit', 'not relevant', 'different needs'],
            severity: 'high'
        },
        'competitor': {
            keywords: ['already using', 'competitor', 'alternative', 'other solution'],
            severity: 'medium'
        }
    };

    for (const [type, config] of Object.entries(objectionPatterns)) {
        for (const keyword of config.keywords) {
            if (transcriptLower.includes(keyword)) {
                objections.push({
                    type: type,
                    severity: config.severity,
                    keyword: keyword,
                    timestamp: transcriptLower.indexOf(keyword) * 10 // Rough timestamp
                });
                break; // Only add once per objection type
            }
        }
    }

    return objections;
}

/**
 * Store analysis results in database
 * @param {string} callId - Call ID
 * @param {Object} analysis - Analysis results
 */
async function storeAnalysis(callId, analysis) {
    try {
        const { intent, emotions, autoTags, objections } = analysis;

        // Store call analysis
        await query(`
            INSERT INTO call_analysis (call_id, intent_label, intent_confidence,
                                     emotion_dominant, emotion_intensity, emotion_volatility,
                                     emotion_timeline)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (call_id) DO UPDATE SET
                intent_label = EXCLUDED.intent_label,
                intent_confidence = EXCLUDED.intent_confidence,
                emotion_dominant = EXCLUDED.emotion_dominant,
                emotion_intensity = EXCLUDED.emotion_intensity,
                emotion_volatility = EXCLUDED.emotion_volatility,
                emotion_timeline = EXCLUDED.emotion_timeline
        `, [
            callId,
            intent.label,
            intent.confidence,
            emotions.dominant,
            emotions.intensity,
            emotions.volatility,
            JSON.stringify(emotions.timeline)
        ]);

        // Store auto-tags
        for (const tag of autoTags) {
            await query(`
                INSERT INTO call_tags (call_id, tag, tag_type, confidence)
                VALUES ($1, $2, 'auto', $3)
                ON CONFLICT (call_id, tag) DO NOTHING
            `, [callId, tag, intent.confidence]);
        }

        // Store objections
        for (const objection of objections) {
            await query(`
                INSERT INTO call_objections (call_id, objection_type, severity, timestamp_seconds)
                VALUES ($1, $2, $3, $4)
            `, [callId, objection.type, objection.severity, objection.timestamp]);
        }

        logger.info(`Analysis stored for call ${callId}`);

    } catch (error) {
        logger.error(`Error storing analysis for call ${callId}:`, error);
        throw error;
    }
}

/**
 * Create follow-up task for high-intent calls
 * @param {string} callId - Call ID
 * @param {Object} intent - Intent analysis
 */
async function createFollowupTask(callId, intent) {
    try {
        // Get call details
        const callResult = await query(`
            SELECT c.contact_id, c.organization_id, co.first_name, co.last_name, co.phone
            FROM calls c
            JOIN contacts co ON c.contact_id = co.id
            WHERE c.id = $1
        `, [callId]);

        if (callResult.rows.length === 0) return;

        const call = callResult.rows[0];

        // Create task in audit logs for now (in production, use proper task system)
        await query(`
            INSERT INTO audit_logs (organization_id, action, resource_type, resource_id, details)
            VALUES ($1, 'high_intent_detected', 'task', $2, $3)
        `, [
            call.organization_id,
            callId,
            JSON.stringify({
                type: 'follow_up_required',
                priority: 'high',
                intent: intent.label,
                confidence: intent.confidence,
                contact: `${call.first_name} ${call.last_name}`,
                phone: call.phone,
                created_at: new Date().toISOString()
            })
        ]);

        logger.info(`Follow-up task created for high-intent call ${callId}`);

    } catch (error) {
        logger.error(`Error creating follow-up task for call ${callId}:`, error);
    }
}

/**
 * Calculate emotion volatility (how much emotions change)
 * @param {string} transcript - Call transcript
 * @returns {number} Volatility score (0-1)
 */
function calculateEmotionVolatility(transcript) {
    // Simple implementation - in production, use more sophisticated analysis
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 2) return 0.0;

    // This is a simplified volatility calculation
    // In production, analyze emotion changes between sentences
    return Math.min(sentences.length / 20, 1.0);
}

/**
 * Generate detailed emotion timeline with per-turn tracking
 * @param {string} transcript - Call transcript
 * @param {string} callId - Call ID for storing detailed turns
 * @returns {Array} Emotion timeline
 */
async function generateEmotionTimeline(transcript, callId = null) {
    try {
        // Split transcript into turns (speaker changes)
        const turns = splitTranscriptIntoTurns(transcript);
        const timeline = [];
        let turnNumber = 0;

        for (const turn of turns) {
            if (turn.text.trim().length > 10) {
                // Analyze emotion for this turn
                const turnEmotion = await analyzeTurnEmotion(turn.text);

                const timelineEntry = {
                    timestamp: turn.timestamp,
                    emotion: turnEmotion.emotion,
                    intensity: turnEmotion.intensity,
                    confidence: turnEmotion.confidence,
                    speaker: turn.speaker,
                    textSnippet: turn.text.substring(0, 100) + '...'
                };

                timeline.push(timelineEntry);

                // Store detailed turn in database if callId provided
                if (callId) {
                    await storeEmotionTurn(callId, turnNumber, turn.speaker, turnEmotion, turn.timestamp, turn.text);
                }

                turnNumber++;
            }
        }

        return timeline;
    } catch (error) {
        logger.error('Error generating emotion timeline:', error);
        return [];
    }
}

/**
 * Split transcript into speaker turns
 * @param {string} transcript - Call transcript
 * @returns {Array} Speaker turns
 */
function splitTranscriptIntoTurns(transcript) {
    // Simple implementation - assumes alternating speakers
    // In production, use speaker diarization
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const turns = [];
    let currentSpeaker = 'agent';
    let currentText = '';
    let timestamp = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (sentence.length > 10) {
            currentText += sentence + '. ';

            // Switch speaker every 2-3 sentences (simplified)
            if (i > 0 && i % 2 === 0) {
                turns.push({
                    speaker: currentSpeaker,
                    text: currentText.trim(),
                    timestamp: timestamp
                });

                currentSpeaker = currentSpeaker === 'agent' ? 'customer' : 'agent';
                currentText = '';
                timestamp += 30; // 30 seconds per turn
            }
        }
    }

    // Add remaining text
    if (currentText.trim().length > 0) {
        turns.push({
            speaker: currentSpeaker,
            text: currentText.trim(),
            timestamp: timestamp
        });
    }

    return turns;
}

/**
 * Analyze emotion for a single turn
 * @param {string} text - Turn text
 * @returns {Object} Turn emotion analysis
 */
async function analyzeTurnEmotion(text) {
    try {
        const emotionKeywords = {
            'positive': ['great', 'excellent', 'amazing', 'wonderful', 'perfect', 'love', 'fantastic', 'yes', 'sure'],
            'negative': ['terrible', 'awful', 'hate', 'disappointed', 'frustrated', 'angry', 'upset', 'no', 'not interested'],
            'neutral': ['okay', 'fine', 'alright', 'maybe', 'perhaps'],
            'curious': ['interesting', 'tell me more', 'how does', 'what about', 'explain', 'can you'],
            'confused': ['confused', 'don\'t understand', 'unclear', 'not sure', 'what do you mean'],
            'frustrated': ['frustrated', 'annoyed', 'irritated', 'fed up', 'enough', 'stop'],
            'excited': ['excited', 'thrilled', 'can\'t wait', 'looking forward', 'awesome', 'brilliant']
        };

        const textLower = text.toLowerCase();
        const emotionScores = {};

        for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
            let score = 0;
            for (const keyword of keywords) {
                const matches = (textLower.match(new RegExp(keyword, 'g')) || []).length;
                score += matches;
            }
            emotionScores[emotion] = score;
        }

        // Find dominant emotion
        const dominantEmotion = Object.keys(emotionScores).reduce((a, b) =>
            emotionScores[a] > emotionScores[b] ? a : b
        );

        const totalScore = Object.values(emotionScores).reduce((a, b) => a + b, 0);
        const intensity = totalScore > 0 ? Math.min(totalScore / 5, 1.0) : 0.1;
        const confidence = totalScore > 0 ? Math.min(totalScore / 3, 1.0) : 0.3;

        return {
            emotion: dominantEmotion,
            intensity: intensity,
            confidence: confidence
        };
    } catch (error) {
        logger.error('Error analyzing turn emotion:', error);
        return {
            emotion: 'neutral',
            intensity: 0.1,
            confidence: 0.3
        };
    }
}

/**
 * Store emotion turn in database
 * @param {string} callId - Call ID
 * @param {number} turnNumber - Turn number
 * @param {string} speaker - Speaker (agent/customer)
 * @param {Object} emotion - Emotion analysis
 * @param {number} timestamp - Timestamp in seconds
 * @param {string} text - Turn text
 */
async function storeEmotionTurn(callId, turnNumber, speaker, emotion, timestamp, text) {
    try {
        await query(`
            INSERT INTO emotion_turns (call_id, turn_number, speaker, emotion, intensity, confidence, timestamp_seconds, text_snippet)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            callId,
            turnNumber,
            speaker,
            emotion.emotion,
            emotion.intensity,
            emotion.confidence,
            timestamp,
            text.substring(0, 500) // Limit text snippet
        ]);
    } catch (error) {
        logger.error('Error storing emotion turn:', error);
    }
}

/**
 * Get analysis results for a call
 * @param {string} callId - Call ID
 * @returns {Object} Analysis results
 */
async function getCallAnalysis(callId) {
    try {
        const result = await query(`
            SELECT ca.intent_label, ca.intent_confidence, ca.emotion_dominant,
                   ca.emotion_intensity, ca.emotion_volatility, ca.emotion_timeline,
                   ca.created_at
            FROM call_analysis ca
            WHERE ca.call_id = $1
        `, [callId]);

        if (result.rows.length === 0) {
            return null;
        }

        const analysis = result.rows[0];

        // Get tags
        const tagsResult = await query(`
            SELECT tag, tag_type, confidence, created_at
            FROM call_tags
            WHERE call_id = $1
            ORDER BY created_at ASC
        `, [callId]);

        // Get objections
        const objectionsResult = await query(`
            SELECT objection_type, severity, timestamp_seconds, created_at
            FROM call_objections
            WHERE call_id = $1
            ORDER BY timestamp_seconds ASC
        `, [callId]);

        return {
            intent: {
                label: analysis.intent_label,
                confidence: analysis.intent_confidence
            },
            emotions: {
                dominant: analysis.emotion_dominant,
                intensity: analysis.emotion_intensity,
                volatility: analysis.emotion_volatility,
                timeline: analysis.emotion_timeline
            },
            tags: tagsResult.rows.map(tag => ({
                tag: tag.tag,
                type: tag.tag_type,
                confidence: tag.confidence,
                createdAt: tag.created_at
            })),
            objections: objectionsResult.rows.map(obj => ({
                type: obj.objection_type,
                severity: obj.severity,
                timestamp: obj.timestamp_seconds,
                createdAt: obj.created_at
            })),
            analyzedAt: analysis.created_at
        };

    } catch (error) {
        logger.error(`Error getting analysis for call ${callId}:`, error);
        throw error;
    }
}

/**
 * Calculate agent empathy score based on emotion improvement during call
 * @param {string} callId - Call ID
 * @param {string} agentId - Agent ID
 * @returns {Object} Empathy score analysis
 */
async function calculateAgentEmpathyScore(callId, agentId) {
    try {
        // Get emotion turns for this call
        const turnsResult = await query(`
            SELECT emotion, intensity, timestamp_seconds, speaker
            FROM emotion_turns
            WHERE call_id = $1
            ORDER BY timestamp_seconds ASC
        `, [callId]);

        if (turnsResult.rows.length < 2) {
            return {
                empathyScore: 0.5,
                emotionImprovement: false,
                initialEmotion: 'neutral',
                finalEmotion: 'neutral'
            };
        }

        const turns = turnsResult.rows;
        const customerTurns = turns.filter(turn => turn.speaker === 'customer');

        if (customerTurns.length < 2) {
            return {
                empathyScore: 0.5,
                emotionImprovement: false,
                initialEmotion: 'neutral',
                finalEmotion: 'neutral'
            };
        }

        const initialEmotion = customerTurns[0].emotion;
        const finalEmotion = customerTurns[customerTurns.length - 1].emotion;

        // Calculate emotion improvement
        const emotionImprovement = calculateEmotionImprovement(initialEmotion, finalEmotion);

        // Calculate empathy score based on emotion improvement and intensity changes
        const empathyScore = calculateEmpathyScore(customerTurns, emotionImprovement);

        // Store empathy score
        await query(`
            INSERT INTO agent_empathy_scores (agent_id, call_id, initial_emotion, final_emotion, empathy_score, emotion_improvement)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [agentId, callId, initialEmotion, finalEmotion, empathyScore, emotionImprovement]);

        return {
            empathyScore,
            emotionImprovement,
            initialEmotion,
            finalEmotion
        };

    } catch (error) {
        logger.error('Error calculating agent empathy score:', error);
        return {
            empathyScore: 0.5,
            emotionImprovement: false,
            initialEmotion: 'neutral',
            finalEmotion: 'neutral'
        };
    }
}

/**
 * Calculate emotion improvement from initial to final emotion
 * @param {string} initialEmotion - Initial emotion
 * @param {string} finalEmotion - Final emotion
 * @returns {boolean} Whether emotion improved
 */
function calculateEmotionImprovement(initialEmotion, finalEmotion) {
    const emotionHierarchy = {
        'negative': 0,
        'frustrated': 1,
        'confused': 2,
        'neutral': 3,
        'curious': 4,
        'positive': 5,
        'excited': 6
    };

    const initialScore = emotionHierarchy[initialEmotion] || 3;
    const finalScore = emotionHierarchy[finalEmotion] || 3;

    return finalScore > initialScore;
}

/**
 * Calculate empathy score based on customer emotion progression
 * @param {Array} customerTurns - Customer emotion turns
 * @param {boolean} emotionImprovement - Whether emotion improved
 * @returns {number} Empathy score (0-1)
 */
function calculateEmpathyScore(customerTurns, emotionImprovement) {
    let score = 0.5; // Base score

    // Bonus for emotion improvement
    if (emotionImprovement) {
        score += 0.3;
    }

    // Bonus for positive emotion intensity
    const positiveTurns = customerTurns.filter(turn =>
        ['positive', 'excited', 'curious'].includes(turn.emotion)
    );
    if (positiveTurns.length > 0) {
        const avgPositiveIntensity = positiveTurns.reduce((sum, turn) => sum + turn.intensity, 0) / positiveTurns.length;
        score += avgPositiveIntensity * 0.2;
    }

    // Penalty for sustained negative emotions
    const negativeTurns = customerTurns.filter(turn =>
        ['negative', 'frustrated', 'angry'].includes(turn.emotion)
    );
    if (negativeTurns.length > customerTurns.length * 0.7) {
        score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
}

/**
 * Generate emotion heatmap data aggregated by time periods
 * @param {string} organizationId - Organization ID
 * @param {string} startDate - Start date filter
 * @param {string} endDate - End date filter
 * @returns {Object} Heatmap data
 */
async function generateEmotionHeatmapData(organizationId, startDate = null, endDate = null) {
    try {
        let dateFilter = '';
        const params = [organizationId];

        if (startDate && endDate) {
            dateFilter = 'AND c.created_at BETWEEN $2 AND $3';
            params.push(startDate, endDate);
        }

        // Get emotion data by hour and day of week
        const result = await query(`
            SELECT
                EXTRACT(HOUR FROM c.created_at) as hour,
                EXTRACT(DOW FROM c.created_at) as day_of_week,
                ca.emotion_dominant,
                COUNT(*) as count,
                AVG(ca.emotion_intensity) as avg_intensity
            FROM calls c
            JOIN call_analysis ca ON c.id = ca.call_id
            WHERE c.organization_id = $1 ${dateFilter}
            GROUP BY EXTRACT(HOUR FROM c.created_at), EXTRACT(DOW FROM c.created_at), ca.emotion_dominant
            ORDER BY hour, day_of_week
        `, params);

        // Transform data for heatmap visualization
        const heatmapData = {};
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        result.rows.forEach(row => {
            const dayName = days[parseInt(row.day_of_week)];
            const hour = parseInt(row.hour);

            if (!heatmapData[dayName]) {
                heatmapData[dayName] = {};
            }

            if (!heatmapData[dayName][hour]) {
                heatmapData[dayName][hour] = {};
            }

            heatmapData[dayName][hour][row.emotion_dominant] = {
                count: parseInt(row.count),
                avgIntensity: parseFloat(row.avg_intensity)
            };
        });

        return heatmapData;

    } catch (error) {
        logger.error('Error generating emotion heatmap data:', error);
        return {};
    }
}

/**
 * Enhanced emotion volatility calculation with sustained emotion detection
 * @param {string} transcript - Call transcript
 * @returns {number} Volatility score (0-1)
 */
function calculateEmotionVolatility(transcript) {
    try {
        const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length < 2) return 0.0;

        // Analyze emotion changes between sentences
        const emotionChanges = [];
        for (let i = 1; i < sentences.length; i++) {
            const prevEmotion = analyzeTurnEmotion(sentences[i - 1]);
            const currEmotion = analyzeTurnEmotion(sentences[i]);

            if (prevEmotion.emotion !== currEmotion.emotion) {
                emotionChanges.push(1);
            } else {
                emotionChanges.push(0);
            }
        }

        // Calculate volatility as ratio of emotion changes
        const volatility = emotionChanges.reduce((sum, change) => sum + change, 0) / emotionChanges.length;

        return Math.min(volatility, 1.0);
    } catch (error) {
        logger.error('Error calculating emotion volatility:', error);
        return 0.0;
    }
}

module.exports = {
    analyzeCallTranscript,
    getCallAnalysis,
    detectIntent,
    analyzeEmotions,
    generateAutoTags,
    detectObjections,
    generateEmotionTimeline,
    calculateAgentEmpathyScore,
    generateEmotionHeatmapData,
    calculateEmotionVolatility
};
