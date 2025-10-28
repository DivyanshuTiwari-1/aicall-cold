const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Enhanced Knowledge Base Service
 * Improved keyword matching and context-aware search
 */

class EnhancedKnowledge {
    constructor() {
        // Common stop words to remove from search
        this.stopWords = new Set([
            'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
            'could', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'on', 'at',
            'for', 'with', 'about', 'as', 'by', 'from', 'up', 'out', 'if', 'what',
            'when', 'where', 'who', 'which', 'this', 'that', 'these', 'those',
            'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
        ]);

        // Cache for frequently asked questions
        this.cache = new Map();
        this.cacheMaxSize = 100;
        this.cacheTTL = 300000; // 5 minutes
    }

    /**
     * Query knowledge base with enhanced matching
     */
    async queryKnowledge(question, organizationId, campaignId = null, conversationHistory = null) {
        try {
            // Check cache first
            const cacheKey = `${organizationId}-${question.toLowerCase().trim()}`;
            const cached = this.cache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
                logger.info(`📦 Knowledge base cache hit for: ${question.substring(0, 50)}...`);
                return cached.data;
            }

            // Extract keywords
            const keywords = this.extractKeywords(question);

            if (keywords.length === 0) {
                logger.warn('No meaningful keywords extracted from question');
                return null;
            }

            logger.info(`🔍 Searching knowledge base with keywords: ${keywords.join(', ')}`);

            // Build search patterns
            const searchPatterns = keywords.map(k => `%${k}%`);

            // Query knowledge base with ranking
            const result = await query(`
                SELECT
                    id,
                    question,
                    answer,
                    category,
                    confidence,
                    -- Calculate relevance score
                    CASE
                        WHEN LOWER(question) = $1 THEN 100 -- Exact match
                        WHEN LOWER(question) LIKE ANY($2) THEN 80 -- Question contains keywords
                        WHEN LOWER(answer) LIKE ANY($3) THEN 60 -- Answer contains keywords
                        ELSE 40
                    END as relevance_score
                FROM knowledge_entries
                WHERE organization_id = $4
                AND is_active = true
                AND (
                    LOWER(question) LIKE ANY($2) OR
                    LOWER(answer) LIKE ANY($3) OR
                    LOWER(category) LIKE ANY($5)
                )
                ORDER BY
                    relevance_score DESC,
                    confidence DESC
                LIMIT 5
            `, [
                question.toLowerCase(),
                searchPatterns,
                searchPatterns,
                organizationId,
                searchPatterns
            ]);

            if (result.rows.length === 0) {
                logger.info('No knowledge base matches found');
                return null;
            }

            // Rank results with context
            const rankedResults = this.rankResults(result.rows, question, conversationHistory);

            const bestMatch = rankedResults[0];

            logger.info(`✅ Found knowledge match: ${bestMatch.question} (score: ${bestMatch.final_score})`);

            // Cache result
            this.addToCache(cacheKey, rankedResults);

            return rankedResults;

        } catch (error) {
            logger.error('Enhanced knowledge query error:', error);
            return null;
        }
    }

    /**
     * Extract meaningful keywords from text
     */
    extractKeywords(text) {
        // Convert to lowercase and remove punctuation
        const cleaned = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .trim();

        // Split into words
        const words = cleaned.split(/\s+/);

        // Filter out stop words and short words
        const keywords = words.filter(word =>
            word.length > 2 &&
            !this.stopWords.has(word) &&
            !word.match(/^\d+$/) // Remove pure numbers
        );

        // Remove duplicates
        return [...new Set(keywords)];
    }

    /**
     * Rank results based on relevance and context
     */
    rankResults(results, question, conversationHistory) {
        return results.map(result => {
            let score = result.relevance_score || 0;

            // Boost score based on confidence
            score += (result.confidence || 0) * 20;

            // Check for exact word matches
            const questionWords = this.extractKeywords(question);
            const resultWords = this.extractKeywords(result.question);

            const exactMatches = questionWords.filter(w => resultWords.includes(w)).length;
            score += exactMatches * 10;

            // Context bonus: if question relates to recent conversation
            if (conversationHistory && conversationHistory.length > 0) {
                const recentTopics = conversationHistory
                    .slice(-3) // Last 3 turns
                    .map(turn => this.extractKeywords(turn.user_input || ''))
                    .flat();

                const contextMatches = questionWords.filter(w => recentTopics.includes(w)).length;
                score += contextMatches * 5;
            }

            return {
                ...result,
                final_score: score
            };
        }).sort((a, b) => b.final_score - a.final_score);
    }

    /**
     * Get contextual answer based on conversation history
     */
    async getContextualAnswer(question, organizationId, conversationHistory) {
        const results = await this.queryKnowledge(question, organizationId, null, conversationHistory);

        if (!results || results.length === 0) {
            return null;
        }

        const bestMatch = results[0];

        // If confidence is too low, suggest fallback
        if (bestMatch.final_score < 50) {
            return {
                answer: bestMatch.answer,
                confidence: 0.3,
                should_fallback: true,
                source: 'knowledge_base_low_confidence'
            };
        }

        return {
            answer: bestMatch.answer,
            confidence: Math.min(bestMatch.final_score / 100, 1.0),
            should_fallback: false,
            source: 'knowledge_base',
            category: bestMatch.category,
            question_match: bestMatch.question
        };
    }

    /**
     * Add result to cache
     */
    addToCache(key, data) {
        // Implement simple LRU cache
        if (this.cache.size >= this.cacheMaxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        logger.info('Knowledge base cache cleared');
    }

    /**
     * Get cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.cacheMaxSize,
            hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
        };
    }
}

module.exports = new EnhancedKnowledge();
