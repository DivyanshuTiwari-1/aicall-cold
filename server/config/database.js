const { Pool } = require('pg');
const logger = require('../utils/logger');

// Detect if running in Docker or locally
const isDocker = process.env.NODE_ENV === 'production' ||
                 process.env.DOCKER_ENV === 'true' ||
                 process.env.DB_HOST === 'postgres' ||
                 process.env.HOSTNAME?.includes('ai_dialer_server');
const defaultHost = 'localhost'; // Always use localhost for local development
const defaultPort = 5433; // Use 5433 for local development (Docker maps 5432->5433)

const dbConfig = {
    host: process.env.DB_HOST || defaultHost,
    port: parseInt(process.env.DB_PORT) || defaultPort,
    database: process.env.DB_NAME || 'ai_dialer',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres', // Use postgres password
};

// Log database configuration for debugging
logger.info('Database configuration:', {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password ? '[REDACTED]' : 'undefined',
    passwordType: typeof dbConfig.password,
    isDocker,
    dockerEnv: process.env.DOCKER_ENV,
    nodeEnv: process.env.NODE_ENV,
    hostname: process.env.HOSTNAME
});

const pool = new Pool(dbConfig);


// Test database connection
async function connectDB() {
    try {
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        logger.info('✅ Database connected successfully');
    } catch (error) {
        logger.error('❌ Database connection failed:', error);
        throw error;
    }
}

// Execute query with error handling
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        logger.error('Database query error:', { text, error: error.message });
        throw error;
    }
}

// Transaction wrapper
async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    connectDB,
    query,
    transaction,
    pool
};
