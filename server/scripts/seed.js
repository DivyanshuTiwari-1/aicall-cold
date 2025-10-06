const { createTables, seedData } = require('./migrate');
const { connectDB } = require('../config/database');
const logger = require('../utils/logger');

async function runSeed() {
    try {
        await connectDB();
        await createTables();
        await seedData();
        logger.info('🎉 Database seeding completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Database seeding failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runSeed();
}

module.exports = { runSeed };