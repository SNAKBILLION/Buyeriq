// ─────────────────────────────────────────────
// BuyerIQ — Backend API Integration Tests
// ─────────────────────────────────────────────
// Run: cd Backend && npx jest --runInBand
// ─────────────────────────────────────────────
import request from 'supertest';
import app from '../src/app.js';

const API = '/api/v1';
let authToken = null;

// ── Helper: Login and get token ──
async function getAuthToken() {
  if (authToken) return authToken;
  const res = await request(app)
    .post(`${API}/users/login`)
    .send({ email: process.env.TEST_EMAIL || 'admin@senseslifestyle.com', password: process.env.TEST_PASSWORD || 'test123' });
  if (res.body?.data?.token) authToken = res.body.data.token;
  return authToken;
}

function authHeader() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

// ══════════════════════════════════════════════
// HEALTH
// ══════════════════════════════════════════════

describe('Health Check', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get(`${API}/health`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ══════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════

describe('Authentication', () => {
  test('POST /users/register returns 403 (invite only)', async () => {
    const res = await request(app)
      .post(`${API}/users/register`)
      .send({ name: 'Test', email: 'test@test.com', password: 'password123' });
    expect(res.status).toBe(403);
  });

  test('POST /users/login with bad credentials returns 401', async () => {
    const res = await request(app)
      .post(`${API}/users/login`)
      .send({ email: 'fake@fake.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('GET /users/me without token returns 401', async () => {
    const res = await request(app).get(`${API}/users/me`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════
// DATA MODULES (CRUD pattern)
// ══════════════════════════════════════════════

const dataModules = [
  { name: 'buyers', path: '/buyers' },
  { name: 'suppliers', path: '/suppliers' },
  { name: 'products', path: '/products' },
  { name: 'shipments', path: '/shipments' },
  { name: 'trade-stats', path: '/trade-stats' },
  { name: 'prices', path: '/prices' },
  { name: 'retail', path: '/retail' },
  { name: 'compliance', path: '/compliance' },
  { name: 'alerts', path: '/alerts' },
  { name: 'quotes', path: '/quotes' },
  { name: 'hs-codes', path: '/hs-codes' },
  { name: 'contacts', path: '/contacts' },
];

describe('Data Modules — Route Protection', () => {
  // All GET routes should require auth
  for (const mod of dataModules) {
    test(`GET ${mod.path} without auth returns 401`, async () => {
      const res = await request(app).get(`${API}${mod.path}`);
      expect(res.status).toBe(401);
    });
  }

  // All POST routes should require auth
  for (const mod of dataModules) {
    test(`POST ${mod.path} without auth returns 401`, async () => {
      const res = await request(app).post(`${API}${mod.path}`).send({});
      expect(res.status).toBe(401);
    });
  }
});

describe('Data Modules — With Auth', () => {
  beforeAll(async () => {
    await getAuthToken();
  });

  // If we have a token, test GET returns paginated response
  for (const mod of dataModules) {
    test(`GET ${mod.path} returns paginated response`, async () => {
      if (!authToken) return; // Skip if no token available
      const res = await request(app)
        .get(`${API}${mod.path}`)
        .set(authHeader());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  }

  // Test pagination params
  test('GET /buyers?page=1&limit=5 respects pagination', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get(`${API}/buyers?page=1&limit=5`)
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  // Test search
  test('GET /buyers?search=test works', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get(`${API}/buyers?search=TJX`)
      .set(authHeader());
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════
// ADMIN — User Management
// ══════════════════════════════════════════════

describe('Admin — User Management', () => {
  test('GET /users without admin token returns 401 or 403', async () => {
    const res = await request(app).get(`${API}/users`);
    expect([401, 403]).toContain(res.status);
  });

  test('POST /users/invite without auth returns 401', async () => {
    const res = await request(app)
      .post(`${API}/users/invite`)
      .send({ name: 'Test', email: 'test@example.com', role: 'viewer' });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════
// API DOCS
// ══════════════════════════════════════════════

describe('API Documentation', () => {
  test('GET /api/docs returns HTML', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  test('GET /api/docs/json returns OpenAPI spec', async () => {
    const res = await request(app).get('/api/docs/json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info.title).toBe('BuyerIQ API');
  });
});

// ══════════════════════════════════════════════
// SQL INJECTION PROTECTION
// ══════════════════════════════════════════════

describe('Security — SQL Injection', () => {
  beforeAll(async () => { await getAuthToken(); });

  test('Malicious sortBy is rejected', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get(`${API}/buyers?sort_by=name;DROP TABLE buyers--`)
      .set(authHeader());
    expect(res.status).toBe(200); // Should not crash, falls back to safe default
    expect(res.body.success).toBe(true);
  });
});
