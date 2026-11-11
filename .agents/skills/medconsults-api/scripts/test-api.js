import fs from 'fs';
import path from 'path';

// Read port from backend/.env if available
let port = '5001';
try {
  const envPath = path.resolve('backend/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/PORT=(\d+)/);
    if (match) port = match[1];
  }
} catch {}

const BASE_URL = process.env.BASE_URL || `http://localhost:${port}`;
console.log(`🩺 Running Medconsults Automated API Test Suite against: ${BASE_URL}\n`);

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`• ${name}... `);
  const start = Date.now();
  try {
    await fn();
    const elapsed = Date.now() - start;
    console.log(`✅ PASS (${elapsed}ms)`);
    passed++;
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ FAIL (${elapsed}ms)\n  Error: ${err.message}`);
    failed++;
  }
}

async function run() {
  // 1. Root Probe
  await test('Server Root / Liveness', async () => {
    const res = await fetch(`${BASE_URL}/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'running') throw new Error(`Unexpected status: ${data.status}`);
  });

  // 2. Health Endpoint
  await test('Health Check /health', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`Status not ok: ${data.status}`);
  });

  // 3. Database Readiness
  await test('Database Readiness /ready', async () => {
    const res = await fetch(`${BASE_URL}/ready`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.database !== 'connected') throw new Error(`Database not connected: ${data.database}`);
  });

  // 4. Public Doctors List
  await test('GET /api/v1/doctors (Public Directory)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/doctors`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(`API reported failure`);
  });

  // 5. User Registration
  const testEmail = `test_runner_${Date.now()}@example.com`;
  const testPassword = 'RunnerPass123!';
  let accessToken = '';

  await test('POST /api/v1/auth/register (New Patient)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        role: 'patient'
      })
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    const data = await res.json();
    if (!data.data?.accessToken) throw new Error('Missing accessToken in response');
    accessToken = data.data.accessToken;
  });

  // 6. User Login
  await test('POST /api/v1/auth/login (Existing Patient)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.data?.accessToken) throw new Error('Missing accessToken');
    accessToken = data.data.accessToken;
  });

  // 7. Authenticated Profile Fetch
  await test('GET /api/v1/users/me (Authenticated Profile)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.data?.user?.email !== testEmail) throw new Error(`Email mismatch: ${data.data?.user?.email}`);
  });

  // 8. Appointments List
  await test('GET /api/v1/appointments (Authenticated Patient Queue)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/appointments`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.data)) throw new Error('Expected array of appointments');
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests.`);
  if (failed > 0) process.exit(1);
}

run().catch(console.error);
