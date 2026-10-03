#!/usr/bin/env node
/**
 * EduMap Mock Server — standalone mock API for local feature testing.
 * NOT used in Docker / Hugging Face Spaces deployment.
 *
 * Usage:
 *   cd frontend/test-app
 *   npm install
 *   node mock-server.js
 *
 * Mock server listens on http://localhost:9001
 * Point your frontend to: NEXT_PUBLIC_API_URL=http://localhost:9001/api
 */

const http = require('http');
const { mockHandlers, findMockHandler } = require('./mock-handlers.ts');

// Re-export for the TypeScript wrapper
module.exports = { mockHandlers, findMockHandler };

const PORT = process.env.MOCK_PORT || 9001;

const server = http.createServer((req, res) => {
  // Enable CORS for local frontend testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', () => {
    const url = req.url || '/';
    const handler = findMockHandler(req.method, url);

    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          message: `Mock not found for ${req.method} ${url}`,
        })
      );
      return;
    }

    try {
      const parsedBody = body ? JSON.parse(body) : {};
      const mockReq = {
        body: parsedBody,
        query: Object.fromEntries(
          (url.split('?')[1] || '')
            .split('&')
            .filter((p) => p)
            .map((p) => {
              const [k, v] = p.split('=');
              return [k, decodeURIComponent(v || '')];
            })
        ),
        params: {},
        headers: req.headers || {},
      };

      const result = handler.handler(mockReq);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Mock server error', error: String(error) }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`🧪 EduMap Mock Server running at http://localhost:${PORT}`);
  console.log(`   Set NEXT_PUBLIC_API_URL=http://localhost:${PORT}/api to use it.`);
  console.log('   Press Ctrl+C to stop.');
});
