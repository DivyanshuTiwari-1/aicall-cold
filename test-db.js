const { query } = require('./server/config/database');

async function testDatabase() {
    try {
        console.log('Testing database connection and schema...');

        // Test if lead_assignments table exists
        const result = await query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'lead_assignments'
            ORDER BY ordinal_position
        `);

        console.log('lead_assignments table columns:', result.rows);

        // Test if we can query the table
        const countResult = await query('SELECT COUNT(*) FROM lead_assignments');
        console.log('lead_assignments count:', countResult.rows[0].count);

    } catch (error) {
        console.error('Database error:', error.message);
    }
}

testDatabase();
