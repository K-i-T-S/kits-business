import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const { Pool } = pg;

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'business_terminal',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Strict allowlist — prevents SQL injection via table/column names
const SCHEMA = {
  products: ['id', 'name', 'description', 'price', 'cost', 'sku', 'stock_quantity', 'category', 'tenant_id', 'created_at', 'updated_at'],
  sales: ['id', 'customer_id', 'employee_id', 'total_amount', 'status', 'sale_date', 'tenant_id', 'created_at', 'updated_at'],
  customers: ['id', 'name', 'email', 'phone', 'address', 'tenant_id', 'created_at', 'updated_at'],
  employees: ['id', 'name', 'email', 'phone', 'position', 'hire_date', 'tenant_id', 'created_at', 'updated_at'],
};

const SORT_ALLOWLIST = new Set([
  'id', 'created_at', 'updated_at', 'name', 'email',
  'sale_date', 'total_amount', 'stock_quantity', 'price',
]);

function validateTable(name) {
  if (!SCHEMA[name]) throw new Error(`Unknown resource: ${name}`);
  return name;
}

function validateColumns(table, cols) {
  const invalid = cols.filter(c => !SCHEMA[table].includes(c));
  if (invalid.length) throw new Error(`Invalid fields: ${invalid.join(', ')}`);
  return cols;
}

function validateSort(col) {
  if (col && !SORT_ALLOWLIST.has(col)) throw new Error(`Cannot sort by: ${col}`);
  return col || null;
}

// ── Middleware ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ data: null, error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ data: null, error: 'Invalid or expired token' });
  }
}

// ── Health (public) ───────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy' });
  }
});

// ── Auth (public) ─────────────────────────────────────────────────────────────

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ data: null, error: 'Valid email and password (min 8 chars) required' });
    }

    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ data: null, error: 'Email already registered' });
    }

    const id = randomUUID();
    const hash = await bcrypt.hash(password, 12);

    const user = await pool.query(
      'INSERT INTO users (id, email, password) VALUES ($1, $2, $3) RETURNING id, email, created_at',
      [id, email, hash]
    );

    const tenantId = randomUUID();
    const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
    await pool.query(
      `INSERT INTO tenant_user_details
         (tenant_id, tenant_name, tenant_slug, user_id, user_role, user_active, tenant_active)
       VALUES ($1, $2, $3, $4, 'owner', true, true)`,
      [tenantId, 'My Business', slug, id]
    );

    const token = jwt.sign(
      { sub: id, email, tenant_id: tenantId, role: 'owner' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ data: { user: user.rows[0], token }, error: null });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ data: null, error: 'Signup failed' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ data: null, error: 'Email and password required' });
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.password, t.tenant_id, t.user_role
       FROM users u
       LEFT JOIN tenant_user_details t ON t.user_id = u.id AND t.user_active = true
       WHERE u.email = $1
       LIMIT 1`,
      [email]
    );

    // Constant-time response prevents user enumeration
    const DUMMY_HASH = '$2b$12$invalidhashpaddingnormalization00';
    const stored = result.rows[0]?.password ?? DUMMY_HASH;
    const valid = await bcrypt.compare(password, stored);

    if (!result.rows[0] || !valid) {
      return res.status(401).json({ data: null, error: 'Invalid credentials' });
    }

    const u = result.rows[0];
    const token = jwt.sign(
      { sub: u.id, email: u.email, tenant_id: u.tenant_id, role: u.user_role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ data: { user: { id: u.id, email: u.email }, token }, error: null });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ data: null, error: 'Signin failed' });
  }
});

// ── Protected CRUD ────────────────────────────────────────────────────────────

app.get('/api/:table', requireAuth, async (req, res) => {
  try {
    const table = validateTable(req.params.table);
    const sort = validateSort(req.query.order);
    const params = [req.user.tenant_id];
    let query = `SELECT * FROM ${table} WHERE tenant_id = $1`;
    if (sort) query += ` ORDER BY ${sort}`;
    if (req.query.limit) { params.push(parseInt(req.query.limit)); query += ` LIMIT $${params.length}`; }
    if (req.query.offset) { params.push(parseInt(req.query.offset)); query += ` OFFSET $${params.length}`; }
    const { rows } = await pool.query(query, params);
    res.json({ data: rows, error: null });
  } catch (err) {
    res.status(400).json({ data: null, error: err.message });
  }
});

app.get('/api/:table/:id', requireAuth, async (req, res) => {
  try {
    const table = validateTable(req.params.table);
    const { rows } = await pool.query(
      `SELECT * FROM ${table} WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!rows.length) return res.status(404).json({ data: null, error: 'Not found' });
    res.json({ data: rows[0], error: null });
  } catch (err) {
    res.status(400).json({ data: null, error: err.message });
  }
});

app.post('/api/:table', requireAuth, async (req, res) => {
  try {
    const table = validateTable(req.params.table);
    const item = { ...req.body, id: randomUUID(), tenant_id: req.user.tenant_id };
    const cols = validateColumns(table, Object.keys(item));
    const vals = cols.map(c => item[c]);
    const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${ph}) RETURNING *`,
      vals
    );
    res.status(201).json({ data: rows[0], error: null });
  } catch (err) {
    res.status(400).json({ data: null, error: err.message });
  }
});

app.put('/api/:table/:id', requireAuth, async (req, res) => {
  try {
    const table = validateTable(req.params.table);
    const updates = req.body;
    const cols = validateColumns(table, Object.keys(updates));
    const vals = cols.map(c => updates[c]);
    const set = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE ${table} SET ${set} WHERE id = $${cols.length + 1} AND tenant_id = $${cols.length + 2} RETURNING *`,
      [...vals, req.params.id, req.user.tenant_id]
    );
    if (!rows.length) return res.status(404).json({ data: null, error: 'Not found' });
    res.json({ data: rows[0], error: null });
  } catch (err) {
    res.status(400).json({ data: null, error: err.message });
  }
});

app.delete('/api/:table/:id', requireAuth, async (req, res) => {
  try {
    const table = validateTable(req.params.table);
    const { rows } = await pool.query(
      `DELETE FROM ${table} WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user.tenant_id]
    );
    if (!rows.length) return res.status(404).json({ data: null, error: 'Not found' });
    res.json({ data: rows[0], error: null });
  } catch (err) {
    res.status(400).json({ data: null, error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log(`Server running on :${PORT} — database connected`);
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
});
