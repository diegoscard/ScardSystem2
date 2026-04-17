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
    const { key, hwid } = req.body;
    
    // Uses ScardAdmin_chaves table managed by SCARDADMIN
    const result = await pool.query('SELECT * FROM "ScardAdmin_chaves" WHERE license_key = $1 AND status = true', [key]);
    
    if (result.rows.length === 0) {
      return res.status(200).json({ valid: false, message: 'Chave inválida ou inativa no banco de dados central' });
    }

    const license = result.rows[0];
    
    // First time use: register HWID in hwid_hash column
    if (!license.hwid_hash) {
      await pool.query('UPDATE "ScardAdmin_chaves" SET hwid_hash = $1 WHERE license_key = $2', [hwid, key]);
      return res.status(200).json({ valid: true });
    }
    
    // Validate existing HWID
    if (license.hwid_hash !== hwid) {
      return res.status(200).json({ valid: false, message: 'Chave já registrada em outro dispositivo' });
    }

    // Expiry check
    if (license.expiry_date && new Date(license.expiry_date) < new Date()) {
      return res.status(200).json({ valid: false, message: 'Licença expirada' });
    }

    return res.status(200).json({ valid: true });
  } catch (error) {
    console.error("Erro Vercel Validate:", error);
    return res.status(500).json({ error: 'DB Error no servidor ou tabela ScardAdmin_chaves não existe' });
  }
}
