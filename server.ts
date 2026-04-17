import express from "express";
import { createServer as createViteServer } from "vite";
import { Pool } from 'pg';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDB() {
  try {
    const client = await pool.connect();
    
    // Create store_data table
    await client.query(`
      CREATE TABLE IF NOT EXISTS store_data (
        store_key VARCHAR(255) PRIMARY KEY,
        data JSONB NOT NULL
      );
    `);

    // Create db_adminkeys table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS "db_adminkeys" (
        id SERIAL PRIMARY KEY,
        key_value VARCHAR(255) UNIQUE NOT NULL,
        hwid_hash VARCHAR(255),
        status BOOLEAN DEFAULT true,
        expiry_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert the key from the user image as a starting point
    await client.query(`
      INSERT INTO "db_adminkeys" (key_value, status)
      VALUES ($1, true)
      ON CONFLICT (key_value) DO NOTHING;
    `, ['YF4H7-XVWDZ-G6ERR-7RLH3-V6TSV']);

    console.log("Database initialized successfully with db_adminkeys!");
    
    client.release();
  } catch (error) {
    console.error("Failed to initialize DB", error);
  }
}

// Global data loading API
app.get("/api/health", (req, res) => {
  res.json({ status: "express_ok" });
});

app.get("/api/sync", async (req, res) => {
  try {
    const result = await pool.query('SELECT store_key, data FROM store_data');
    const stateObj: Record<string, any> = {};
    for (const row of result.rows) {
      stateObj[row.store_key] = row.data;
    }
    res.json(stateObj);
  } catch (error) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// Sync data endpoint
app.post("/api/sync/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const body = req.body;
    await pool.query(`
      INSERT INTO store_data (store_key, data)
      VALUES ($1, $2)
      ON CONFLICT (store_key) DO UPDATE SET data = EXCLUDED.data;
    `, [key, JSON.stringify(body)]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// License Validation API
app.post("/api/license/validate", async (req, res) => {
  try {
    const { key, hwid } = req.body;
    // Uses db_adminkeys as requested by user
    const result = await pool.query('SELECT * FROM "db_adminkeys" WHERE "key_value" = $1 AND status = true', [key]);
    
    if (result.rows.length === 0) {
      return res.json({ valid: false, message: 'Chave inválida ou inativa no banco central' });
    }

    const license = result.rows[0];
    
    // First time use: register HWID in hwid_hash column
    if (!license.hwid_hash) {
      await pool.query('UPDATE "db_adminkeys" SET hwid_hash = $1 WHERE "key_value" = $2', [hwid, key]);
      return res.json({ valid: true });
    }
    
    // Validate existing HWID
    if (license.hwid_hash !== hwid) {
      return res.json({ valid: false, message: 'Chave já registrada em outro dispositivo' });
    }

    // Expiry check
    if (license.expiry_date && new Date(license.expiry_date) < new Date()) {
      return res.json({ valid: false, message: 'Licença expirada' });
    }

    return res.json({ valid: true });
  } catch (error) {
    console.error("Erro na validação de licença:", error);
    res.status(500).json({ error: 'DB Error no servidor ou tabela db_adminkeys não encontrada' });
  }
});


async function startServer() {
  await initDB();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built client
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
