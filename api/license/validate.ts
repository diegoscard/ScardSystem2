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
    
    // Fallback: se o banco está vazio ou tabelas não criadas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id SERIAL PRIMARY KEY,
        license_key VARCHAR(255) UNIQUE NOT NULL,
        hwid_hash VARCHAR(255),
        status BOOLEAN DEFAULT true,
        expiry_date TIMESTAMP,
        linked_system VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Inserir credenciais básicas local de fallback
    const validKeys = [
      "QJ4UC-6G0HA-25T07-0KK4R-SJPPA",
      "A1B2C-D3E4F-G5H6I-J7K8L-M9N0P",
      "LK98-J32HD-19KSD-34KJD-LKS98"
    ];
    
    for (const testKey of validKeys) {
      await pool.query(`
        INSERT INTO licenses (license_key, status) 
        VALUES ($1, true) 
        ON CONFLICT (license_key) DO NOTHING;
      `, [testKey]);
    }

    const result = await pool.query('SELECT * FROM licenses WHERE license_key = $1 AND status = true', [key]);
    
    if (result.rows.length === 0) {
      return res.status(200).json({ valid: false, message: 'Chave inválida ou inativa no banco de dados' });
    }

    const license = result.rows[0];
    
    // First time use: register HWID in hwid_hash column
    if (!license.hwid_hash) {
      await pool.query('UPDATE licenses SET hwid_hash = $1 WHERE license_key = $2', [hwid, key]);
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
    console.error(error);
    return res.status(500).json({ error: 'DB Error no servidor' });
  }
}
