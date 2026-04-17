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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const key = req.query.key as string;
    const body = req.body;
    
    // Fallback: se req.body for string, tenta parsear, pra compatibilidade 
    let parsedBody = body;
    if (typeof body === 'string') {
      try { parsedBody = JSON.parse(body); } catch (e) {}
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS store_data (
        store_key VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL
      );
    `);

    await pool.query(`
      INSERT INTO store_data (store_key, data)
      VALUES ($1, $2)
      ON CONFLICT (store_key) DO UPDATE SET data = EXCLUDED.data;
    `, [key, JSON.stringify(parsedBody)]);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'DB Error' });
  }
}
