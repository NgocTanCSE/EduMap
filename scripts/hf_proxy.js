// hf_proxy.js — thin reverse proxy for HF Spaces.
//
// Replaces the Next.js frontend on the single public port (7680) once the UI
// moves to Vercel. Routes:
//   /api/ai/*  -> 127.0.0.1:8000  (FastAPI ai-service)
//   /api/*     -> 127.0.0.1:3000  (NestJS backend)
//   /health    -> 200 {"status":"ok"}
//   anything else -> 404
//
// Node stdlib only — no npm dependency. Keeps the HF image small and the
// proxy's own memory footprint negligible (~30 MB).
'use strict';

const http = require('http');

const PORT = Number(process.env.HF_PROXY_PORT || 7680);
const BACKEND = { host: '127.0.0.1', port: Number(process.env.BACKEND_PORT || 3000) };
const AI = { host: '127.0.0.1', port: Number(process.env.AI_SERVICE_PORT || 8000) };

function targetFor(path) {
  if (path === '/health' || path === '/healthz') return null; // handled locally
  if (path.startsWith('/api/ai/') || path === '/api/ai') return AI;
  if (path.startsWith('/api/')) return BACKEND;
  return undefined; // 404
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  // HF Spaces health check / build-log viewer hits the root path. Return 200 so
  // the Space is reported as running (the UI itself lives on Vercel now).
  const pathname = url.split('?')[0];
  if (pathname === '/' || pathname === '/health' || pathname === '/healthz') {
    const body = JSON.stringify({
      status: 'ok',
      service: 'hf-proxy',
      note: 'Frontend is hosted on Vercel; this Space serves /api/* only.',
    });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
    return;
  }

  const target = targetFor(url);
  if (!target) {
    const body = JSON.stringify({ message: 'Not found', path: url });
    res.writeHead(404, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
    return;
  }

  const opts = {
    host: target.host,
    port: target.port,
    path: url,
    method: req.method,
    headers: Object.assign({}, req.headers, { host: `${target.host}:${target.port}` }),
  };

  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      const body = JSON.stringify({ message: 'Upstream unavailable', error: err.code || err.message });
      res.writeHead(502, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
      res.end(body);
    } else {
      try { res.end(); } catch (e) { /* ignore */ }
    }
  });

  req.pipe(proxyReq, { end: true });
});

server.on('error', (err) => {
  console.error('[hf-proxy] server error:', err && err.message);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[hf-proxy] listening on 0.0.0.0:${PORT} (backend ${BACKEND.host}:${BACKEND.port}, ai ${AI.host}:${AI.port})`);
});
