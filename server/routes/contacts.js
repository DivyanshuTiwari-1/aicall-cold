const express = require('express');
const Joi = require('joi');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

// Validation schemas
const contactSchema = Joi.object({
    campaign_id: Joi.string().uuid().optional().allow(null, ''),
    first_name: Joi.string().min(1).max(100).required(),
    last_name: Joi.string().max(100).optional().allow(null, ''),
    phone: Joi.string().min(10).max(20).required(),
    email: Joi.string().email().optional().allow(null, ''),
    company: Joi.string().max(255).optional().allow(null, ''),
    title: Joi.string().max(255).optional().allow(null, ''),
    industry: Joi.string().max(100).optional().allow(null, ''),
    location: Joi.string().max(255).optional().allow(null, ''),
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
router.post('/', authenticateToken, async(req, res) => {
    try {
        const { error, value } = contactSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        let {
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

        // If campaign_id is not provided, try to get or create a default campaign
        if (!campaign_id || campaign_id === '') {
            // Check if a default campaign exists for this organization
            const defaultCampaignCheck = await query(
                'SELECT id FROM campaigns WHERE organization_id = $1 AND name = $2 LIMIT 1',
                [req.organizationId, 'Manual Leads']
            );

            if (defaultCampaignCheck.rows.length > 0) {
                campaign_id = defaultCampaignCheck.rows[0].id;
            } else {
                // Create a default campaign
                const createDefaultCampaign = await query(`
                    INSERT INTO campaigns (organization_id, name, description, status)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                `, [req.organizationId, 'Manual Leads', 'Campaign for manually added leads', 'active']);
                campaign_id = createDefaultCampaign.rows[0].id;
                logger.info(`Created default campaign for organization ${req.organizationId}`);
            }
        } else {
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
        }

        // Check if contact already exists in this organization (by phone)
        const existingContact = await query(
            'SELECT id FROM contacts WHERE organization_id = $1 AND phone = $2', [req.organizationId, phone]
        );

        if (existingContact.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Contact with this phone number already exists'
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
router.post('/bulk', authenticateToken, async(req, res) => {
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

// Import contacts from CSV file
router.post('/import', authenticateToken, upload.single('file'), async(req, res) => {
    let filePath = null;

    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Get campaign ID from form data
        const campaignId = req.body.campaignId;

        if (!campaignId) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: 'Campaign ID is required'
            });
        }

        // Verify campaign belongs to organization
        const campaignCheck = await query(
            'SELECT id FROM campaigns WHERE id = $1 AND organization_id = $2',
            [campaignId, req.organizationId]
        );

        if (campaignCheck.rows.length === 0) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        filePath = req.file.path;
        const contacts = [];

        // Parse CSV file
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv({
                    mapHeaders: ({ header }) => header.toLowerCase().trim()
                }))
                .on('data', (row) => {
                    // Normalize the row data
                    const contact = {
                        first_name: row.first_name || row.firstname || row['first name'] || '',
                        last_name: row.last_name || row.lastname || row['last name'] || '',
                        phone: row.phone || row.phone_number || row['phone number'] || '',
                        email: row.email || row.email_address || row['email address'] || '',
                        company: row.company || row.organization || '',
                        title: row.title || row.job_title || row['job title'] || '',
                        industry: row.industry || '',
                        location: row.location || row.city || '',
                    };

                    // Only add if we have at least first_name and phone
                    if (contact.first_name && contact.phone) {
                        contacts.push(contact);
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // Clean up the uploaded file
        fs.unlinkSync(filePath);
        filePath = null;

        if (contacts.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid contacts found in CSV file. Please ensure the file has first_name and phone columns.'
            });
        }

        const results = {
            created: 0,
            skipped: 0,
            errors: []
        };

        // Process contacts
        for (const contactData of contacts) {
            try {
                // Validate phone number format (basic validation)
                const phoneRegex = /^\+?[1-9]\d{1,14}$/;
                if (!phoneRegex.test(contactData.phone.replace(/[\s\-\(\)]/g, ''))) {
                    results.errors.push({
                        contact: contactData,
                        error: 'Invalid phone number format'
                    });
                    continue;
                }

                // Normalize phone number (remove spaces, dashes, parentheses)
                const normalizedPhone = contactData.phone.replace(/[\s\-\(\)]/g, '');

                // Check if contact already exists
                const existingContact = await query(
                    'SELECT id FROM contacts WHERE campaign_id = $1 AND phone = $2',
                    [campaignId, normalizedPhone]
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
                    campaignId,
                    contactData.first_name,
                    contactData.last_name || null,
                    normalizedPhone,
                    contactData.email || null,
                    contactData.company || null,
                    contactData.title || null,
                    contactData.industry || null,
                    contactData.location || null,
                    JSON.stringify({})
                ]);

                results.created++;
            } catch (error) {
                results.errors.push({
                    contact: contactData,
                    error: error.message
                });
            }
        }

        logger.info(`CSV contact import: ${results.created} created, ${results.skipped} skipped, ${results.errors.length} errors`);

        res.json({
            success: true,
            message: 'CSV import completed',
            results
        });

    } catch (error) {
        // Clean up uploaded file if it still exists
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        logger.error('CSV contact import error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to process CSV import'
        });
    }
});

// Get contact statistics
router.get('/stats', authenticateToken, async(req, res) => {
    try {
        const result = await query(`
            SELECT
                COUNT(*) as total_contacts,
                COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted,
                COUNT(CASE WHEN status = 'interested' THEN 1 END) as interested,
                COUNT(CASE WHEN status = 'not_interested' THEN 1 END) as not_interested,
                COUNT(CASE WHEN status = 'do_not_call' THEN 1 END) as do_not_call,
                COUNT(CASE WHEN last_contacted IS NOT NULL THEN 1 END) as assigned
            FROM contacts
            WHERE organization_id = $1
        `, [req.organizationId]);

        const stats = result.rows[0];
        const conversionRate = stats.contacted > 0 ?
            Math.round((stats.interested / stats.contacted) * 100) : 0;

        res.json({
            success: true,
            stats: {
                totalContacts: parseInt(stats.total_contacts),
                contacted: parseInt(stats.contacted),
                assigned: parseInt(stats.assigned),
                conversionRate: conversionRate
            }
        });

    } catch (error) {
        logger.error('Contact stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact statistics'
        });
    }
});

// Get contacts
router.get('/', authenticateToken, async(req, res) => {
    try {
        const {
            campaign_id,
            campaign,
            status,
            search,
            assigned,
            unassigned,
            limit = 50,
            offset = 0
        } = req.query;

        let whereClause = 'WHERE c.organization_id = $1';
        const params = [req.organizationId];
        let paramCount = 1;

        // Support both campaign_id and campaign query params
        const campaignFilter = campaign_id || campaign;
        if (campaignFilter) {
            paramCount++;
            whereClause += ` AND c.campaign_id = $${paramCount}`;
            params.push(campaignFilter);
        }

        if (status) {
            paramCount++;
            whereClause += ` AND c.status = $${paramCount}`;
            params.push(status);
        }

        if (search) {
            paramCount++;
            whereClause += ` AND (c.first_name ILIKE $${paramCount} OR c.last_name ILIKE $${paramCount} OR c.phone ILIKE $${paramCount} OR c.email ILIKE $${paramCount} OR c.company ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        // Filter by assignment status
        if (assigned === 'assigned') {
            whereClause += ` AND la.assigned_to IS NOT NULL AND la.status IN ('pending', 'in_progress')`;
        } else if (assigned === 'unassigned' || unassigned === 'true' || unassigned === true) {
            whereClause += ` AND (la.assigned_to IS NULL OR la.status NOT IN ('pending', 'in_progress'))`;
        }

        const result = await query(`
      SELECT
        c.*,
        COUNT(cl.id) as call_count,
        MAX(cl.created_at) as last_call_date,
        la.assigned_to,
        la.status as assignment_status,
        u.first_name as assigned_agent_first_name,
        u.last_name as assigned_agent_last_name
      FROM contacts c
      LEFT JOIN calls cl ON c.id = cl.contact_id
      LEFT JOIN lead_assignments la ON c.id = la.contact_id AND la.status IN ('pending', 'in_progress')
      LEFT JOIN users u ON la.assigned_to = u.id
      ${whereClause}
      GROUP BY c.id, la.assigned_to, la.status, u.first_name, u.last_name
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
            updatedAt: contact.updated_at,
            assignedTo: contact.assigned_to,
            assignmentStatus: contact.assignment_status,
            assignedAgentName: contact.assigned_agent_first_name && contact.assigned_agent_last_name
                ? `${contact.assigned_agent_first_name} ${contact.assigned_agent_last_name}`
                : null
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
router.get('/:id', authenticateToken, async(req, res) => {
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
router.put('/:id', authenticateToken, async(req, res) => {
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
router.delete('/:id', authenticateToken, async(req, res) => {
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

// Bulk delete contacts
router.post('/bulk-delete', authenticateToken, async(req, res) => {
    try {
        const { contactIds } = req.body;

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No contact IDs provided'
            });
        }

        // Delete contacts that belong to the user's organization
        const result = await query(
            'DELETE FROM contacts WHERE id = ANY($1) AND organization_id = $2 RETURNING id',
            [contactIds, req.organizationId]
        );

        const deletedCount = result.rowCount;

        logger.info(`Bulk deleted ${deletedCount} contacts by user ${req.user.id}`);

        res.json({
            success: true,
            message: `Successfully deleted ${deletedCount} contacts`,
            deletedCount
        });

    } catch (error) {
        logger.error('Bulk contact deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete contacts'
        });
    }
});

// Bulk update contact status
router.post('/bulk-update-status', authenticateToken, async(req, res) => {
    try {
        const { campaignId, status } = req.body;

        if (!campaignId) {
            return res.status(400).json({
                success: false,
                message: 'Campaign ID is required'
            });
        }

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        // Validate status value
        const validStatuses = ['new', 'pending', 'contacted', 'retry', 'failed', 'dnc'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Verify campaign belongs to organization
        const campaignCheck = await query(
            'SELECT id FROM campaigns WHERE id = $1 AND organization_id = $2',
            [campaignId, req.organizationId]
        );

        if (campaignCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Update all contacts in the campaign
        const result = await query(`
            UPDATE contacts
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE campaign_id = $2 AND organization_id = $3
            RETURNING id
        `, [status, campaignId, req.organizationId]);

        const updatedCount = result.rowCount;

        // Get current count of contacts with the new status
        const countResult = await query(
            'SELECT COUNT(*) as count FROM contacts WHERE campaign_id = $1 AND status = $2',
            [campaignId, status]
        );

        logger.info(`Bulk updated ${updatedCount} contacts to status '${status}' for campaign ${campaignId}`);

        res.json({
            success: true,
            message: `Successfully updated ${updatedCount} contacts to status '${status}'`,
            updatedCount,
            totalWithStatus: parseInt(countResult.rows[0].count)
        });

    } catch (error) {
        logger.error('Bulk contact status update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update contact statuses'
        });
    }
});

module.exports = router;
