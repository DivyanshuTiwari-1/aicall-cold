const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Middleware to validate request data against a Joi schema
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate (default: 'body')
 * @returns {Function} Express middleware function
 */
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req[property], {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });

      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('Validation error:', {
          property,
          errors: errorDetails,
          body: req.body,
          query: req.query,
          params: req.params
        });

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errorDetails
        });
      }

      // Replace the request property with the validated and sanitized value
      req[property] = value;
      next();
    } catch (err) {
      logger.error('Validation middleware error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal validation error'
      });
    }
  };
};

/**
 * Middleware to validate query parameters
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const validateQuery = (schema) => {
  return validateRequest(schema, 'query');
};

/**
 * Middleware to validate request parameters
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const validateParams = (schema) => {
  return validateRequest(schema, 'params');
};

/**
 * Common validation schemas
 */
const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  optionalUuid: Joi.string().uuid().optional(),
  email: Joi.string().email().required(),
  optionalEmail: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  optionalPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
    page: Joi.number().integer().min(1).optional()
  }),
  dateRange: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
  })
};

/**
 * Validation helper for common patterns
 */
const validationHelpers = {
  /**
   * Validate pagination parameters
   */
  validatePagination: validateQuery(commonSchemas.pagination),

  /**
   * Validate date range parameters
   */
  validateDateRange: validateQuery(commonSchemas.dateRange),

  /**
   * Validate UUID parameter
   */
  validateUuidParam: (paramName = 'id') => {
    const schema = Joi.object({
      [paramName]: commonSchemas.uuid
    });
    return validateParams(schema);
  }
};

module.exports = {
  validateRequest,
  validateQuery,
  validateParams,
  commonSchemas,
  validationHelpers
};
