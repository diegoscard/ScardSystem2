import type { VercelRequest, VercelResponse } from '@vercel/node';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
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
    const { hwid } = req.body;
    if (!hwid) return res.status(200).json({ valid: false });
    
    // Check if any active key is registered to this HWID
    const result = await pool.query('SELECT * FROM "keys" WHERE hwid = $1 AND status = \'active\'', [hwid]);
    
    if (result.rows.length === 0) {
      return res.status(200).json({ valid: false });
    }

    const license = result.rows[0];
    
    // Expiry check
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return res.status(200).json({ valid: false });
    }

    return res.status(200).json({ valid: true });
  } catch (error) {
    console.error("Erro Vercel Check HWID:", error);
    return res.status(500).json({ error: 'DB Error' });
  }
}
