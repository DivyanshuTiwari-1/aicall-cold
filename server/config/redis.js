const redis = require('redis');
const logger = require('../utils/logger');

let redisClient;

async function connectRedis() {
    try {
        redisClient = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        logger.error('Redis max retry attempts reached');
                        return new Error('Max retry attempts reached');
                    }
                    const delay = Math.min(retries * 100, 3000);
                    logger.info(`Redis reconnecting in ${delay}ms...`);
                    return delay;
                }
            }
        });

        redisClient.on('error', (err) => {
            logger.error('Redis Client Error:', err);
        });

        redisClient.on('connect', () => {
            logger.info('✅ Redis connected successfully');
        });

        await redisClient.connect();
        return redisClient;
    } catch (error) {
        logger.error('❌ Redis connection failed:', error);
        throw error;
    }
}

// Cache operations
async function get(key) {
    try {
        const value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        logger.error('Redis GET error:', error);
        return null;
    }
}

async function set(key, value, expireInSeconds = 3600) {
    try {
        await redisClient.setEx(key, expireInSeconds, JSON.stringify(value));
    } catch (error) {
        logger.error('Redis SET error:', error);
    }
}

async function del(key) {
    try {
        await redisClient.del(key);
    } catch (error) {
        logger.error('Redis DEL error:', error);
    }
}

// Queue operations for Bull
async function getQueue() {
    return redisClient;
}

module.exports = {
    connectRedis,
    get,
    set,
    del,
    getQueue,
    getClient: () => redisClient
};