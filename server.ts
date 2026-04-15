import express from 'express';
import { createServer as createViteServer } from 'vite';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Database connection
  const connectionString = process.env.POSTGRES_URL?.replace(/^"|"$/g, ''); // Remove quotes if present

  if (!connectionString) {
    console.error('CRITICAL: POSTGRES_URL environment variable is not set.');
  } else {
    const url = new URL(connectionString);
    console.log(`Attempting to connect to database host: ${url.hostname}`);
  }

  const pool = new Pool({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Initialize database
  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_data (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
    console.log('Database initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
    if ((err as any).code === 'EAI_AGAIN') {
      console.error('DNS Resolution failed. Please check if the database host in POSTGRES_URL is correct and accessible.');
    }
  }

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get('/api/data/:key', async (req, res) => {
    try {
      const { key } = req.params;
      const result = await pool.query('SELECT data FROM app_data WHERE key = $1', [key]);
      if (result.rows.length > 0) {
        res.json(result.rows[0].data);
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/data/:key', async (req, res) => {
    try {
      const { key } = req.params;
      const data = req.body;
      await pool.query(
        'INSERT INTO app_data (key, data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP',
        [key, data]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/migrate', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const items = req.body; // Expecting { key: data }
      for (const [key, data] of Object.entries(items)) {
        await client.query(
          'INSERT INTO app_data (key, data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP',
          [key, data]
        );
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: (err as Error).message });
    } finally {
      client.release();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
