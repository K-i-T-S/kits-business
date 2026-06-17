import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'business_terminal',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

app.use(express.json());

// Initialize database schema
async function initializeDatabase() {
  try {
    const schema = await import('../database/schema.sql', { type: 'text' });
    await pool.query(schema.default);
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});

// Generic CRUD operations for all tables
app.get('/api/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { limit, offset, order } = req.query;
    
    let query = `SELECT * FROM ${table}`;
    const params = [];
    
    if (order) {
      query += ` ORDER BY ${order}`;
    }
    
    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }
    
    if (offset) {
      params.push(parseInt(offset));
      query += ` OFFSET $${params.length}`;
    }
    
    const result = await pool.query(query, params);
    res.json({ data: result.rows, error: null });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ data: null, error: error.message });
  }
});

app.get('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ data: null, error: 'Not found' });
    }
    
    res.json({ data: result.rows[0], error: null });
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ data: null, error: error.message });
  }
});

app.post('/api/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const item = req.body;
    
    const columns = Object.keys(item);
    const values = Object.values(item);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    res.json({ data: result.rows[0], error: null });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ data: null, error: error.message });
  }
});

app.put('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const updates = req.body;
    
    const columns = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    
    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE id = $${columns.length + 1}
      RETURNING *
    `;
    
    const result = await pool.query(query, [...values, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ data: null, error: 'Not found' });
    }
    
    res.json({ data: result.rows[0], error: null });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ data: null, error: error.message });
  }
});

app.delete('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ data: null, error: 'Not found' });
    }
    
    res.json({ data: result.rows[0], error: null });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ data: null, error: error.message });
  }
});

// Auth endpoints
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const id = Math.random().toString(36).substring(2, 15);
    
    const result = await pool.query(
      `INSERT INTO users (id, email, password) VALUES ($1, $2, $3) RETURNING *`,
      [id, email, password]
    );
    
    // Create default tenant
    const tenantId = Math.random().toString(36).substring(2, 15);
    await pool.query(
      `INSERT INTO tenant_user_details (tenant_id, tenant_name, tenant_slug, user_id, user_role, user_active, tenant_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, 'Local Business', 'local', id, 'owner', true, true]
    );
    
    res.json({ data: result.rows[0], error: null });
  } catch (error) {
    console.error('Error signing up:', error);
    res.status(500).json({ data: null, error: error.message });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1 AND password = $2`,
      [email, password]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ data: null, error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Check if user has tenant
    const tenantResult = await pool.query(
      `SELECT * FROM tenant_user_details WHERE user_id = $1`,
      [user.id]
    );
    
    if (tenantResult.rows.length === 0) {
      // Create default tenant
      const tenantId = Math.random().toString(36).substring(2, 15);
      await pool.query(
        `INSERT INTO tenant_user_details (tenant_id, tenant_name, tenant_slug, user_id, user_role, user_active, tenant_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, 'Local Business', 'local', user.id, 'owner', true, true]
      );
    }
    
    res.json({ data: user, error: null });
  } catch (error) {
    console.error('Error signing in:', error);
    res.status(500).json({ data: null, error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Backend API server running on port ${PORT}`);
  await initializeDatabase();
});
