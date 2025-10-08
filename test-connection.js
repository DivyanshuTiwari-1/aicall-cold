const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'ai_dialer',
    user: 'postgres',
    password: 'postgres',
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Connection FAILED:', err.message);
    } else {
        console.log('Connection SUCCESS!', res.rows[0]);
    }
    pool.end();
    process.exit(err ? 1 : 0);
});