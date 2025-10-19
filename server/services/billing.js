const { query } = require('../config/database');
const logger = require('../utils/logger');

// Credit-based Billing System

/**
 * Consume credits for a call
 * @param {string} organizationId - Organization ID
 * @param {string} callId - Call ID
 * @param {string} callType - 'automated' or 'manual'
 * @param {number} duration - Call duration in seconds
 * @returns {Object} Billing result
 */
async function consumeCredit(organizationId, callId, callType, duration) {
    try {
        // Calculate cost based on call type and duration
        const cost = calculateCallCost(callType, duration);

        if (cost <= 0) {
            logger.info(`No credit consumption for call ${callId} (duration: ${duration}s)`);
            return { success: true, cost: 0, consumed: false };
        }

        // Check if credits available
        const orgResult = await query(`
            SELECT credits_balance, license_seats
            FROM organizations
            WHERE id = $1
        `, [organizationId]);

        if (orgResult.rows.length === 0) {
            throw new Error('Organization not found');
        }

        const org = orgResult.rows[0];

        if (org.credits_balance < cost) {
            throw new Error('Insufficient credits');
        }

        // Deduct credits
        await query(`
            UPDATE organizations
            SET credits_balance = credits_balance - $1,
                credits_consumed = credits_consumed + $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [cost, organizationId]);

        // Log transaction
        await logCreditTransaction(organizationId, -cost, 'consumption', callId,
            `Call ${callType} - ${Math.round(duration / 60)} minutes`);

        // Update call record with cost
        await query(`
            UPDATE calls
            SET cost = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [cost, callId]);

        logger.info(`Credits consumed: ${cost} for call ${callId} (${callType}, ${duration}s)`);

        return {
            success: true,
            cost: cost,
            consumed: true,
            remainingCredits: org.credits_balance - cost
        };

    } catch (error) {
        logger.error(`Credit consumption error for call ${callId}:`, error);
        throw error;
    }
}

/**
 * Calculate call cost based on type and duration
 * @param {string} callType - 'automated' or 'manual'
 * @param {number} duration - Duration in seconds
 * @returns {number} Cost in credits
 */
function calculateCallCost(callType, duration) {
    // Only charge for connected calls (≥30 seconds)
    if (duration < 30) {
        return 0;
    }

    // Base cost per call
    const baseCost = 1; // 1 credit per connected call

    // Additional cost for longer calls (every 5 minutes)
    const additionalMinutes = Math.floor((duration - 30) / 300); // 300 seconds = 5 minutes
    const additionalCost = additionalMinutes * 0.5; // 0.5 credits per additional 5 minutes

    return baseCost + additionalCost;
}

/**
 * Add credits to organization
 * @param {string} organizationId - Organization ID
 * @param {number} amount - Amount to add
 * @param {string} description - Transaction description
 * @returns {Object} Result
 */
async function addCredits(organizationId, amount, description = 'Credit purchase') {
    try {
        if (amount <= 0) {
            throw new Error('Invalid credit amount');
        }

        // Add credits
        await query(`
            UPDATE organizations
            SET credits_balance = credits_balance + $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [amount, organizationId]);

        // Log transaction
        await logCreditTransaction(organizationId, amount, 'purchase', null, description);

        // Get updated balance
        const orgResult = await query(`
            SELECT credits_balance FROM organizations WHERE id = $1
        `, [organizationId]);

        logger.info(`Credits added: ${amount} to organization ${organizationId}`);

        return {
            success: true,
            amount: amount,
            newBalance: orgResult.rows[0].credits_balance
        };

    } catch (error) {
        logger.error(`Add credits error for organization ${organizationId}:`, error);
        throw error;
    }
}

/**
 * Refund credits
 * @param {string} organizationId - Organization ID
 * @param {number} amount - Amount to refund
 * @param {string} callId - Call ID (if applicable)
 * @param {string} reason - Refund reason
 * @returns {Object} Result
 */
async function refundCredits(organizationId, amount, callId = null, reason = 'Refund') {
    try {
        if (amount <= 0) {
            throw new Error('Invalid refund amount');
        }

        // Add credits back
        await query(`
            UPDATE organizations
            SET credits_balance = credits_balance + $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [amount, organizationId]);

        // Log transaction
        await logCreditTransaction(organizationId, amount, 'refund', callId, reason);

        // Get updated balance
        const orgResult = await query(`
            SELECT credits_balance FROM organizations WHERE id = $1
        `, [organizationId]);

        logger.info(`Credits refunded: ${amount} to organization ${organizationId}`);

        return {
            success: true,
            amount: amount,
            newBalance: orgResult.rows[0].credits_balance
        };

    } catch (error) {
        logger.error(`Refund credits error for organization ${organizationId}:`, error);
        throw error;
    }
}

/**
 * Log credit transaction
 * @param {string} organizationId - Organization ID
 * @param {number} amount - Amount (positive for credit, negative for debit)
 * @param {string} type - Transaction type
 * @param {string} callId - Call ID (if applicable)
 * @param {string} description - Transaction description
 */
async function logCreditTransaction(organizationId, amount, type, callId, description) {
    try {
        await query(`
            INSERT INTO credit_transactions (organization_id, amount, type, description, call_id)
            VALUES ($1, $2, $3, $4, $5)
        `, [organizationId, amount, type, description, callId]);

    } catch (error) {
        logger.error(`Error logging credit transaction:`, error);
        throw error;
    }
}

/**
 * Get organization billing summary
 * @param {string} organizationId - Organization ID
 * @param {string} period - Time period ('1d', '7d', '30d', 'all')
 * @returns {Object} Billing summary
 */
async function getBillingSummary(organizationId, period = '30d') {
    try {
        // Get organization details
        const orgResult = await query(`
            SELECT credits_balance, credits_consumed, license_seats, created_at
            FROM organizations
            WHERE id = $1
        `, [organizationId]);

        if (orgResult.rows.length === 0) {
            throw new Error('Organization not found');
        }

        const org = orgResult.rows[0];

        // Build date filter
        let dateFilter = '';
        if (period === '1d') {
            dateFilter = 'AND created_at >= CURRENT_DATE';
        } else if (period === '7d') {
            dateFilter = 'AND created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
        } else if (period === '30d') {
            dateFilter = 'AND created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
        }

        // Get transaction summary
        const transactionResult = await query(`
            SELECT
                type,
                SUM(amount) as total_amount,
                COUNT(*) as transaction_count
            FROM credit_transactions
            WHERE organization_id = $1 ${dateFilter}
            GROUP BY type
        `, [organizationId]);

        // Get call usage
        const callUsageResult = await query(`
            SELECT
                call_type,
                COUNT(*) as call_count,
                SUM(cost) as total_cost,
                AVG(cost) as avg_cost,
                SUM(duration) as total_duration
            FROM calls
            WHERE organization_id = $1
              AND cost > 0
              ${dateFilter}
            GROUP BY call_type
        `, [organizationId]);

        // Get recent transactions
        const recentTransactionsResult = await query(`
            SELECT amount, type, description, created_at, call_id
            FROM credit_transactions
            WHERE organization_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [organizationId]);

        const transactions = transactionResult.rows.reduce((acc, row) => {
            acc[row.type] = {
                totalAmount: parseFloat(row.total_amount),
                transactionCount: parseInt(row.transaction_count)
            };
            return acc;
        }, {});

        const callUsage = callUsageResult.rows.reduce((acc, row) => {
            acc[row.call_type] = {
                callCount: parseInt(row.call_count),
                totalCost: parseFloat(row.total_cost),
                avgCost: parseFloat(row.avg_cost),
                totalDuration: parseInt(row.total_duration)
            };
            return acc;
        }, {});

        return {
            organization: {
                creditsBalance: parseFloat(org.credits_balance),
                creditsConsumed: parseFloat(org.credits_consumed),
                licenseSeats: parseInt(org.license_seats),
                createdAt: org.created_at
            },
            transactions: {
                purchase: transactions.purchase || { totalAmount: 0, transactionCount: 0 },
                consumption: transactions.consumption || { totalAmount: 0, transactionCount: 0 },
                refund: transactions.refund || { totalAmount: 0, transactionCount: 0 }
            },
            callUsage: {
                automated: callUsage.automated || { callCount: 0, totalCost: 0, avgCost: 0, totalDuration: 0 },
                manual: callUsage.manual || { callCount: 0, totalCost: 0, avgCost: 0, totalDuration: 0 }
            },
            recentTransactions: recentTransactionsResult.rows.map(tx => ({
                amount: parseFloat(tx.amount),
                type: tx.type,
                description: tx.description,
                createdAt: tx.created_at,
                callId: tx.call_id
            }))
        };

    } catch (error) {
        logger.error(`Get billing summary error for organization ${organizationId}:`, error);
        throw error;
    }
}

/**
 * Check if organization has sufficient credits
 * @param {string} organizationId - Organization ID
 * @param {number} requiredCredits - Required credits
 * @returns {boolean} Has sufficient credits
 */
async function hasSufficientCredits(organizationId, requiredCredits = 1) {
    try {
        const result = await query(`
            SELECT credits_balance FROM organizations WHERE id = $1
        `, [organizationId]);

        if (result.rows.length === 0) {
            return false;
        }

        return result.rows[0].credits_balance >= requiredCredits;

    } catch (error) {
        logger.error(`Check credits error for organization ${organizationId}:`, error);
        return false;
    }
}

/**
 * Get credit usage analytics
 * @param {string} organizationId - Organization ID
 * @param {string} period - Time period
 * @returns {Object} Usage analytics
 */
async function getUsageAnalytics(organizationId, period = '30d') {
    try {
        let dateFilter = '';
        if (period === '1d') {
            dateFilter = 'AND c.created_at >= CURRENT_DATE';
        } else if (period === '7d') {
            dateFilter = 'AND c.created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
        } else if (period === '30d') {
            dateFilter = 'AND c.created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
        }

        // Daily usage
        const dailyUsageResult = await query(`
            SELECT
                DATE(c.created_at) as date,
                COUNT(*) as call_count,
                SUM(c.cost) as total_cost,
                SUM(c.duration) as total_duration
            FROM calls c
            WHERE c.organization_id = $1
              AND c.cost > 0
              ${dateFilter}
            GROUP BY DATE(c.created_at)
            ORDER BY DATE(c.created_at) DESC
        `, [organizationId]);

        // Usage by call type
        const typeUsageResult = await query(`
            SELECT
                call_type,
                COUNT(*) as call_count,
                SUM(cost) as total_cost,
                AVG(cost) as avg_cost,
                AVG(duration) as avg_duration
            FROM calls
            WHERE organization_id = $1
              AND cost > 0
              ${dateFilter}
            GROUP BY call_type
        `, [organizationId]);

        // Top users by credit consumption
        const topUsersResult = await query(`
            SELECT
                u.first_name,
                u.last_name,
                u.role_type,
                COUNT(c.id) as call_count,
                SUM(c.cost) as total_cost
            FROM calls c
            JOIN users u ON c.initiated_by = u.id
            WHERE c.organization_id = $1
              AND c.cost > 0
              ${dateFilter}
            GROUP BY u.id, u.first_name, u.last_name, u.role_type
            ORDER BY SUM(c.cost) DESC
            LIMIT 10
        `, [organizationId]);

        return {
            dailyUsage: dailyUsageResult.rows.map(day => ({
                date: day.date,
                callCount: parseInt(day.call_count),
                totalCost: parseFloat(day.total_cost),
                totalDuration: parseInt(day.total_duration)
            })),
            typeUsage: typeUsageResult.rows.map(type => ({
                callType: type.call_type,
                callCount: parseInt(type.call_count),
                totalCost: parseFloat(type.total_cost),
                avgCost: parseFloat(type.avg_cost),
                avgDuration: parseFloat(type.avg_duration)
            })),
            topUsers: topUsersResult.rows.map(user => ({
                name: `${user.first_name} ${user.last_name}`,
                role: user.role_type,
                callCount: parseInt(user.call_count),
                totalCost: parseFloat(user.total_cost)
            }))
        };

    } catch (error) {
        logger.error(`Get usage analytics error for organization ${organizationId}:`, error);
        throw error;
    }
}

module.exports = {
    consumeCredit,
    addCredits,
    refundCredits,
    getBillingSummary,
    hasSufficientCredits,
    getUsageAnalytics,
    calculateCallCost
};