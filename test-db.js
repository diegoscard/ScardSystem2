import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const res = await pool.query('SELECT * FROM licenses');
  console.log(res.rows);
  process.exit(0);
}
run().catch(console.error);
