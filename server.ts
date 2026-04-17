import express from "express";
import { createServer as createViteServer } from "vite";
import { Pool } from 'pg';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Broadcast and Heartbeat
function broadcast(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Keep-alive heartbeat (every 30s)
setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'ping' }));
    }
  });
}, 30000);

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

    // Create session table for "No Rastro local" persistence
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_sessions (
        hwid VARCHAR(255) PRIMARY KEY,
        user_data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    client.release();
    console.log("Database initialized successfully!");
  } catch (error) {
    console.error("Failed to initialize DB", error);
  }
}

// Session API
app.post("/api/auth/session", async (req, res) => {
  try {
    const { hwid, user } = req.body;
    if (!hwid) return res.status(400).json({ error: 'Missing HWID' });
    
    if (user) {
      await pool.query(`
        INSERT INTO app_sessions (hwid, user_data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (hwid) DO UPDATE SET user_data = EXCLUDED.user_data, updated_at = CURRENT_TIMESTAMP;
      `, [hwid, JSON.stringify(user)]);
      return res.json({ success: true });
    } else {
      // Logout - remove session
      await pool.query('DELETE FROM app_sessions WHERE hwid = $1', [hwid]);
      return res.json({ success: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Session Error' });
  }
});

app.get("/api/auth/session/:hwid", async (req, res) => {
  try {
    const { hwid } = req.params;
    const result = await pool.query('SELECT user_data FROM app_sessions WHERE hwid = $1', [hwid]);
    if (result.rows.length > 0) {
      res.json({ user: result.rows[0].user_data });
    } else {
      res.json({ user: null });
    }
  } catch (error) {
    res.status(500).json({ error: 'Session Error' });
  }
});

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
    
    // Broadcast update to all clients
    broadcast({ type: 'update', key, data: body });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// License Validation API
app.post("/api/license/check-hwid", async (req, res) => {
  try {
    const { hwid } = req.body;
    if (!hwid) return res.json({ valid: false });
    
    // Check if any active key is registered to this HWID
    const result = await pool.query('SELECT * FROM "keys" WHERE hwid = $1 AND status = \'active\'', [hwid]);
    
    if (result.rows.length === 0) {
      return res.json({ valid: false });
    }

    const license = result.rows[0];
    
    // Expiry check
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return res.json({ valid: false });
    }

    return res.json({ valid: true });
  } catch (error) {
    res.status(500).json({ error: 'DB Error' });
  }
});

app.post("/api/license/validate", async (req, res) => {
  try {
    const { key, hwid } = req.body;
    // Uses the new "keys" table according to the image
    const result = await pool.query('SELECT * FROM "keys" WHERE key_value = $1 AND status = \'active\'', [key]);
    
    if (result.rows.length === 0) {
      return res.json({ valid: false, message: 'Chave inválida ou inativa no banco central' });
    }

    const license = result.rows[0];
    
    // First time use: register HWID in "hwid" column
    if (!license.hwid) {
      await pool.query('UPDATE "keys" SET hwid = $1 WHERE key_value = $2', [hwid, key]);
      return res.json({ valid: true });
    }
    
    // Validate existing HWID
    if (license.hwid !== hwid) {
      return res.json({ valid: false, message: 'Chave já registrada em outro dispositivo' });
    }

    // Expiry check - using "expires_at" from the image
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return res.json({ valid: false, message: 'Licença expirada' });
    }

    return res.json({ valid: true });
  } catch (error) {
    console.error("Erro na validação de licença:", error);
    res.status(500).json({ error: 'DB Error no servidor ou tabela keys não encontrada' });
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
