const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const contactSchema = Joi.object({
    campaign_id: Joi.string().uuid().required(),
    first_name: Joi.string().min(1).max(100).required(),
    last_name: Joi.string().max(100).optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    email: Joi.string().email().optional(),
    company: Joi.string().max(255).optional(),
    title: Joi.string().max(255).optional(),
    industry: Joi.string().max(100).optional(),
    location: Joi.string().max(255).optional(),
    custom_fields: Joi.object().default({})
});

const bulkContactSchema = Joi.object({
    campaign_id: Joi.string().uuid().required(),
    contacts: Joi.array().items(
        Joi.object({
            first_name: Joi.string().min(1).max(100).required(),
            last_name: Joi.string().max(100).optional(),
            phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
            email: Joi.string().email().optional(),
            company: Joi.string().max(255).optional(),
            title: Joi.string().max(255).optional(),
            industry: Joi.string().max(100).optional(),
            location: Joi.string().max(255).optional(),
            custom_fields: Joi.object().default({})
        })
    ).min(1).max(1000).required()
});

// Create single contact
router.post('/', async(req, res) => {
    try {
        const { error, value } = contactSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const {
            campaign_id,
            first_name,
            last_name,
            phone,
            email,
            company,
            title,
            industry,
            location,
            custom_fields
        } = value;

        // Verify campaign belongs to organization
        const campaignCheck = await query(
            'SELECT id FROM campaigns WHERE id = $1 AND organization_id = $2', [campaign_id, req.organizationId]
        );

        if (campaignCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Check if contact already exists in this campaign
        const existingContact = await query(
            'SELECT id FROM contacts WHERE campaign_id = $1 AND phone = $2', [campaign_id, phone]
        );

        if (existingContact.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Contact with this phone number already exists in this campaign'
            });
        }

        const result = await query(`
      INSERT INTO contacts (
        organization_id, campaign_id, first_name, last_name, phone, email,
        company, title, industry, location, custom_fields
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
            req.organizationId,
            campaign_id,
            first_name,
            last_name,
            phone,
            email,
            company,
            title,
            industry,
            location,
            JSON.stringify(custom_fields)
        ]);

        const contact = result.rows[0];

        logger.info(`Contact created: ${contact.id} in campaign ${campaign_id}`);

        res.status(201).json({
            success: true,
            message: 'Contact created successfully',
            contact: {
                id: contact.id,
                campaignId: contact.campaign_id,
                firstName: contact.first_name,
                lastName: contact.last_name,
                phone: contact.phone,
                email: contact.email,
                company: contact.company,
                title: contact.title,
                industry: contact.industry,
                location: contact.location,
                customFields: contact.custom_fields,
                status: contact.status,
                lastContacted: contact.last_contacted,
                createdAt: contact.created_at,
                updatedAt: contact.updated_at
            }
        });

    } catch (error) {
        logger.error('Contact creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create contact'
        });
    }
});

// Bulk upload contacts
router.post('/bulk', async(req, res) => {
    try {
        const { error, value } = bulkContactSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const { campaign_id, contacts } = value;

        // Verify campaign belongs to organization
        const campaignCheck = await query(
            'SELECT id FROM campaigns WHERE id = $1 AND organization_id = $2', [campaign_id, req.organizationId]
        );

        if (campaignCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        const results = {
            created: 0,
            skipped: 0,
            errors: []
        };

        // Process contacts in batches
        for (const contactData of contacts) {
            try {
                // Check if contact already exists
                const existingContact = await query(
                    'SELECT id FROM contacts WHERE campaign_id = $1 AND phone = $2', [campaign_id, contactData.phone]
                );

                if (existingContact.rows.length > 0) {
                    results.skipped++;
                    continue;
                }

                await query(`
          INSERT INTO contacts (
            organization_id, campaign_id, first_name, last_name, phone, email,
            company, title, industry, location, custom_fields
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
                    req.organizationId,
                    campaign_id,
                    contactData.first_name,
                    contactData.last_name,
                    contactData.phone,
                    contactData.email,
                    contactData.company,
                    contactData.title,
                    contactData.industry,
                    contactData.location,
                    JSON.stringify(contactData.custom_fields || {})
                ]);

                results.created++;
            } catch (error) {
                results.errors.push({
                    contact: contactData,
                    error: error.message
                });
            }
        }

        logger.info(`Bulk contact upload: ${results.created} created, ${results.skipped} skipped, ${results.errors.length} errors`);

        res.json({
            success: true,
            message: 'Bulk upload completed',
            results
        });

    } catch (error) {
        logger.error('Bulk contact creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process bulk upload'
        });
    }
});

// Get contacts
router.get('/', async(req, res) => {
    try {
        const {
            campaign_id,
            status,
            search,
            limit = 50,
            offset = 0
        } = req.query;

        let whereClause = 'WHERE organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        if (campaign_id) {
            paramCount++;
            whereClause += ` AND campaign_id = $${paramCount}`;
            params.push(campaign_id);
        }

        if (status) {
            paramCount++;
            whereClause += ` AND status = $${paramCount}`;
            params.push(status);
        }

        if (search) {
            paramCount++;
            whereClause += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR phone ILIKE $${paramCount} OR email ILIKE $${paramCount} OR company ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        const result = await query(`
      SELECT 
        c.*,
        COUNT(cl.id) as call_count,
        MAX(cl.created_at) as last_call_date
      FROM contacts c
      LEFT JOIN calls cl ON c.id = cl.contact_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, parseInt(limit), parseInt(offset)]);

        const contacts = result.rows.map(contact => ({
            id: contact.id,
            campaignId: contact.campaign_id,
            firstName: contact.first_name,
            lastName: contact.last_name,
            phone: contact.phone,
            email: contact.email,
            company: contact.company,
            title: contact.title,
            industry: contact.industry,
            location: contact.location,
            customFields: contact.custom_fields,
            status: contact.status,
            callCount: parseInt(contact.call_count),
            lastCallDate: contact.last_call_date,
            lastContacted: contact.last_contacted,
            createdAt: contact.created_at,
            updatedAt: contact.updated_at
        }));

        res.json({
            success: true,
            contacts,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: contacts.length
            }
        });

    } catch (error) {
        logger.error('Contacts fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contacts'
        });
    }
});

// Get single contact
router.get('/:id', async(req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
      SELECT 
        c.*,
        COUNT(cl.id) as call_count,
        MAX(cl.created_at) as last_call_date
      FROM contacts c
      LEFT JOIN calls cl ON c.id = cl.contact_id
      WHERE c.id = $1 AND c.organization_id = $2
      GROUP BY c.id
    `, [id, req.organizationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        const contact = result.rows[0];

        res.json({
            success: true,
            contact: {
                id: contact.id,
                campaignId: contact.campaign_id,
                firstName: contact.first_name,
                lastName: contact.last_name,
                phone: contact.phone,
                email: contact.email,
                company: contact.company,
                title: contact.title,
                industry: contact.industry,
                location: contact.location,
                customFields: contact.custom_fields,
                status: contact.status,
                callCount: parseInt(contact.call_count),
                lastCallDate: contact.last_call_date,
                lastContacted: contact.last_contacted,
                createdAt: contact.created_at,
                updatedAt: contact.updated_at
            }
        });

    } catch (error) {
        logger.error('Contact fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact'
        });
    }
});

// Update contact
router.put('/:id', async(req, res) => {
    try {
        const { id } = req.params;
        const updateSchema = Joi.object({
            first_name: Joi.string().min(1).max(100).optional(),
            last_name: Joi.string().max(100).optional(),
            phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
            email: Joi.string().email().optional(),
            company: Joi.string().max(255).optional(),
            title: Joi.string().max(255).optional(),
            industry: Joi.string().max(100).optional(),
            location: Joi.string().max(255).optional(),
            custom_fields: Joi.object().optional(),
            status: Joi.string().valid('new', 'contacted', 'interested', 'not_interested', 'do_not_call').optional()
        });

        const { error, value } = updateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        // Check if contact exists
        const existingContact = await query(
            'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2', [id, req.organizationId]
        );

        if (existingContact.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        // Build update query dynamically
        const updates = [];
        const params = [];
        let paramCount = 0;

        Object.keys(value).forEach(key => {
            if (value[key] !== undefined) {
                paramCount++;
                updates.push(`${key} = $${paramCount}`);
                params.push(key === 'custom_fields' ? JSON.stringify(value[key]) : value[key]);
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id, req.organizationId);

        const result = await query(`
      UPDATE contacts 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount + 1} AND organization_id = $${paramCount + 2}
      RETURNING *
    `, params);

        const contact = result.rows[0];

        logger.info(`Contact updated: ${contact.id} by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Contact updated successfully',
            contact: {
                id: contact.id,
                campaignId: contact.campaign_id,
                firstName: contact.first_name,
                lastName: contact.last_name,
                phone: contact.phone,
                email: contact.email,
                company: contact.company,
                title: contact.title,
                industry: contact.industry,
                location: contact.location,
                customFields: contact.custom_fields,
                status: contact.status,
                lastContacted: contact.last_contacted,
                updatedAt: contact.updated_at
            }
        });

    } catch (error) {
        logger.error('Contact update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update contact'
        });
    }
});

// Delete contact
router.delete('/:id', async(req, res) => {
    try {
        const { id } = req.params;

        // Check if contact exists
        const existingContact = await query(
            'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2', [id, req.organizationId]
        );

        if (existingContact.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        await query('DELETE FROM contacts WHERE id = $1 AND organization_id = $2', [id, req.organizationId]);

        logger.info(`Contact deleted: ${id} by user ${req.user.id}`);

        res.json({
            success: true,
            message: 'Contact deleted successfully'
        });

    } catch (error) {
        logger.error('Contact deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete contact'
        });
    }
});

module.exports = router;