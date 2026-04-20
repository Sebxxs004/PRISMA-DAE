const fs = require('fs');
const path = require('path');
const { Client } = require('../server/node_modules/pg');

(async () => {
  try {
    let sql = fs.readFileSync(path.resolve(__dirname, '../init.sql'), 'utf8');
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";?/gi, 'CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    sql = sql.replace(/uuid_generate_v4\(\)/gi, 'gen_random_uuid()');

    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    await client.query(sql);
    await client.end();
    console.log('SEED_OK');
  } catch (error) {
    console.error('SEED_ERROR', error.message);
    process.exit(1);
  }
})();
