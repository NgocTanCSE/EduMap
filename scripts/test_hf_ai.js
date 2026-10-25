// Quick diagnostic script for HF Spaces AI routes
// Usage: node scripts/test_hf_ai.js [base_url]
const https = require('https');
const crypto = require('crypto');

const BASE = process.argv[2] || 'https://tancse2005-edumap.hf.space';
const JWT_SECRET = 'edumap-local-dev-secret'; // from .env — verifyJWT on BFF uses this

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
const payload = b64url(Buffer.from(JSON.stringify({
  sub: 1,
  role: 'student',
  email: 'test@edumap.ai',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})));
const sig = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + payload).digest();
const token = header + '.' + payload + '.' + b64url(sig);

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: opts.headers || {},
      timeout: 25000,
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.status, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

(async () => {
  console.log('=== TEST 1: /api/ai/learning-path (career/roadmap AI) ===');
  try {
    const res = await fetch(`${BASE}/api/ai/learning-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ target_role: 'Fullstack Developer', current_level: 'Beginner', time_commitment_hours_per_week: 15 }),
    });
    console.log(`Status: ${res.status}`);
    console.log(`Body: ${res.body.substring(0, 500)}`);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }

  console.log('\n=== TEST 2: /api/ai/chat (ai-chat) ===');
  try {
    const res = await fetch(`${BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: 'Xin chào', history: [], context: {} }),
    });
    console.log(`Status: ${res.status}`);
    console.log(`Body: ${res.body.substring(0, 500)}`);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }

  console.log('\n=== TEST 3: /api/ai/history ===');
  try {
    const res = await fetch(`${BASE}/api/ai/history?user_id=1`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log(`Status: ${res.status}`);
    console.log(`Body: ${res.body.substring(0, 500)}`);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
})();
