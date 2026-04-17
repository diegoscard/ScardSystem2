import type { VercelRequest, VercelResponse } from '@vercel/node';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Inicializar tabela caso não exista
    await pool.query(`
      CREATE TABLE IF NOT EXISTS store_data (
        store_key VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL
      );
    `);

    if (req.method === 'GET') {
      const result = await pool.query('SELECT store_key, data FROM store_data');
      const stateObj: Record<string, any> = {};
      for (const row of result.rows) {
        stateObj[row.store_key] = row.data;
      }
      return res.status(200).json(stateObj);
    } 
    
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'DB Error' });
  }
}
