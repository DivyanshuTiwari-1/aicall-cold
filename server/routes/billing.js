const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { consumeCredit, purchaseCredits, getCreditBalance, logCreditTransaction } = require('../services/billing');

const router = express.Router();

// Validation schemas
const purchaseCreditsSchema = Joi.object({
    amount: Joi.number().positive().required(),
    paymentMethod: Joi.string().required(),
    description: Joi.string().optional()
});

const consumeCreditSchema = Joi.object({
    callId: Joi.string().uuid().required(),
    callType: Joi.string().valid('automated', 'manual').required(),
    duration: Joi.number().integer().min(0).required()
});

// Get organization credit balance
router.get('/balance', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const balance = await getCreditBalance(req.user.organizationId);

        res.json({
            success: true,
            balance: {
                available: balance.credits_balance,
                consumed: balance.credits_consumed,
                totalPurchased: balance.credits_balance + balance.credits_consumed
            }
        });

    } catch (error) {
        logger.error('Get credit balance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get credit balance'
        });
    }
});

// Purchase credits
router.post('/purchase', authenticateToken, requireRole('admin'), async(req, res) => {
    try {
        const { error, value } = purchaseCreditsSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details
            });
        }

        const { amount, paymentMethod, description } = value;

        // Process credit purchase
        const result = await purchaseCredits(req.user.organizationId, amount, paymentMethod, description);

        // Broadcast credit update
        if (global.broadcastCreditUpdate) {
            global.broadcastCreditUpdate(req.user.organizationId, {
                type: 'purchase',
                amount,
                newBalance: result.newBalance
            });
        }

        res.json({
            success: true,
            message: 'Credits purchased successfully',
            transaction: result.transaction,
            newBalance: result.newBalance
        });

    } catch (error) {
        logger.error('Purchase credits error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to purchase credits'
        });
    }
});

// Consume credits for a call
router.post('/consume', authenticateToken, requireRole('admin', 'manager', 'agent'), async(req, res) => {
    try {
        const { error, value } = consumeCreditSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details
            });
        }

        const { callId, callType, duration } = value;

        // Consume credits
        const result = await consumeCredit(req.user.organizationId, callId, callType, duration);

        // Broadcast credit update
        if (global.broadcastCreditUpdate) {
            global.broadcastCreditUpdate(req.user.organizationId, {
                type: 'consumption',
                amount: result.amount,
                callId,
                newBalance: result.newBalance
            });
        }

        res.json({
            success: true,
            message: 'Credits consumed successfully',
            transaction: result.transaction,
            newBalance: result.newBalance
        });

    } catch (error) {
        logger.error('Consume credits error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to consume credits'
        });
    }
});

// Get credit transaction history
router.get('/transactions', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { page = 1, limit = 50, type, startDate, endDate } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE ct.organization_id = $1';
        let params = [req.user.organizationId];
        let paramIndex = 2;

        if (type) {
            whereClause += ` AND ct.type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (startDate && endDate) {
            whereClause += ` AND ct.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            params.push(startDate, endDate);
            paramIndex += 2;
        }

        const result = await query(`
            SELECT
                ct.*,
                c.contact_id,
                cont.first_name,
                cont.last_name,
                cont.phone,
                u.first_name as user_first_name,
                u.last_name as user_last_name
            FROM credit_transactions ct
            LEFT JOIN calls c ON ct.call_id = c.id
            LEFT JOIN contacts cont ON c.contact_id = cont.id
            LEFT JOIN users u ON ct.created_by = u.id
            ${whereClause}
            ORDER BY ct.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...params, limit, offset]);

        // Get total count
        const countResult = await query(`
            SELECT COUNT(*) as total
            FROM credit_transactions ct
            ${whereClause}
        `, params);

        res.json({
            success: true,
            transactions: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(countResult.rows[0].total / limit)
            }
        });

    } catch (error) {
        logger.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get transactions'
        });
    }
});

// Get credit usage analytics
router.get('/usage-analytics', authenticateToken, requireRole('admin', 'manager'), async(req, res) => {
    try {
        const { period = '30d' } = req.query;

        const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;

        // Daily usage breakdown
        const dailyUsage = await query(`
            SELECT
                DATE(ct.created_at) as date,
                SUM(CASE WHEN ct.type = 'consumption' THEN ABS(ct.amount) ELSE 0 END) as consumed,
                SUM(CASE WHEN ct.type = 'purchase' THEN ct.amount ELSE 0 END) as purchased,
                COUNT(CASE WHEN ct.type = 'consumption' THEN 1 END) as call_count
            FROM credit_transactions ct
            WHERE ct.organization_id = $1
                AND ct.created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(ct.created_at)
            ORDER BY date DESC
        `, [req.user.organizationId]);

        // Usage by call type
        const usageByType = await query(`
            SELECT
                c.call_type,
                COUNT(*) as call_count,
                SUM(ABS(ct.amount)) as credits_consumed,
                AVG(ABS(ct.amount)) as avg_credits_per_call
            FROM credit_transactions ct
            JOIN calls c ON ct.call_id = c.id
            WHERE ct.organization_id = $1
                AND ct.type = 'consumption'
                AND ct.created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY c.call_type
        `, [req.user.organizationId]);

        // Top users by credit consumption
        const topUsers = await query(`
            SELECT
                u.first_name,
                u.last_name,
                u.email,
                COUNT(ct.id) as transaction_count,
                SUM(ABS(ct.amount)) as credits_consumed
            FROM credit_transactions ct
            JOIN calls c ON ct.call_id = c.id
            JOIN users u ON c.initiated_by = u.id
            WHERE ct.organization_id = $1
                AND ct.type = 'consumption'
                AND ct.created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY u.id, u.first_name, u.last_name, u.email
            ORDER BY credits_consumed DESC
            LIMIT 10
        `, [req.user.organizationId]);

        res.json({
            success: true,
            analytics: {
                dailyUsage: dailyUsage.rows,
                usageByType: usageByType.rows,
                topUsers: topUsers.rows,
                period
            }
        });

    } catch (error) {
        logger.error('Usage analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get usage analytics'
        });
    }
});

// Refund credits
router.post('/refund', authenticateToken, requireRole('admin'), async(req, res) => {
    try {
        const { transactionId, reason, amount } = req.body;

        if (!transactionId || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Transaction ID and reason are required'
            });
        }

        // Get original transaction
        const transactionResult = await query(`
            SELECT * FROM credit_transactions
            WHERE id = $1 AND organization_id = $2
        `, [transactionId, req.user.organizationId]);

        if (transactionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        const originalTransaction = transactionResult.rows[0];
        const refundAmount = amount || Math.abs(originalTransaction.amount);

        // Create refund transaction
        const refundResult = await query(`
            INSERT INTO credit_transactions (
                organization_id, amount, type, description,
                call_id, created_by
            ) VALUES ($1, $2, 'refund', $3, $4, $5)
            RETURNING *
        `, [
            req.user.organizationId,
            refundAmount,
            `Refund: ${reason}`,
            originalTransaction.call_id,
            req.user.id
        ]);

        // Update organization balance
        await query(`
            UPDATE organizations
            SET credits_balance = credits_balance + $1,
                credits_consumed = credits_consumed - $1
            WHERE id = $2
        `, [refundAmount, req.user.organizationId]);

        // Get updated balance
        const balanceResult = await query(`
            SELECT credits_balance FROM organizations WHERE id = $1
        `, [req.user.organizationId]);

        // Broadcast credit update
        if (global.broadcastCreditUpdate) {
            global.broadcastCreditUpdate(req.user.organizationId, {
                type: 'refund',
                amount: refundAmount,
                newBalance: balanceResult.rows[0].credits_balance
            });
        }

        res.json({
            success: true,
            message: 'Credits refunded successfully',
            refund: refundResult.rows[0],
            newBalance: balanceResult.rows[0].credits_balance
        });

    } catch (error) {
        logger.error('Refund credits error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refund credits'
        });
    }
});

module.exports = router;