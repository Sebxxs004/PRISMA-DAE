const pool = require('./server/db');
async function run() {
  try {
    await pool.query(`ALTER TABLE grupos_asociacion ADD COLUMN IF NOT EXISTS patron_criminal VARCHAR(255) DEFAULT '';`);
    console.log('Column added or already exists.');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
run();