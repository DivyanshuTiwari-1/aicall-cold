const { Pool } = require('pg');
const logger = require('../utils/logger');

// Detect if running in Docker or locally
const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';
const defaultHost = isDocker ? 'postgres' : 'localhost';
const defaultPort = isDocker ? 5432 : 5433; // Docker uses 5432, local uses 5433

const pool = new Pool({
    host: process.env.DB_HOST || defaultHost,
    port: parseInt(process.env.DB_PORT) || defaultPort,
    database: process.env.DB_NAME || 'ai_dialer',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});


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