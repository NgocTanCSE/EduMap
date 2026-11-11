'use strict';

const http = require('http');

const PORT = Number(process.env.HF_PROXY_PORT || 7680);
const BACKEND = { host: '127.0.0.1', port: Number(process.env.BACKEND_PORT || 3000) };
const AI = { host: '127.0.0.1', port: Number(process.env.AI_SERVICE_PORT || 8000) };

function targetFor(path) {
  if (path === '/health' || path === '/healthz') return null;
  // Phase 1: `/api/ai/*` lands on the Rust backend, which proxies verbatim
  // into the ai-service on :8000 (the old NestJS backend did the same).
  if (path.startsWith('/api/ai/') || path === '/api/ai') return BACKEND;
  if (path.startsWith('/api/')) return BACKEND;
  return undefined;
}

function rewritePath(url) {
  if (url.startsWith('/api/socket.io')) {
    return url.replace(/^\/api\/socket\.io/, '/socket.io');
  }
  return url;
}

function pipeUpgrade(req, socket, head, target) {
  const path = rewritePath(req.url || '/');
  const headers = Object.assign({}, req.headers, { host: `${target.host}:${target.port}` });
  const proxyReq = http.request({
    host: target.host,
    port: target.port,
    path,
    method: req.method,
    headers,
  });
  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    let raw = `HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n`;
    for (let i = 0; i < proxyRes.rawHeaders.length; i += 2) {
      raw += `${proxyRes.rawHeaders[i]}: ${proxyRes.rawHeaders[i + 1]}\r\n`;
    }
    raw += '\r\n';
    socket.write(raw);
    if (proxyHead && proxyHead.length) socket.write(proxyHead);
    if (head && head.length) proxySocket.write(head);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
    proxySocket.on('error', () => { try { socket.destroy(); } catch (e) {} });
    socket.on('error', () => { try { proxySocket.destroy(); } catch (e) {} });
    socket.on('close', () => { try { proxySocket.destroy(); } catch (e) {} });
    proxySocket.on('close', () => { try { socket.destroy(); } catch (e) {} });
  });
  proxyReq.on('error', (err) => {
    try { socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n'); } catch (e) {}
    try { socket.destroy(); } catch (e) {}
  });
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const pathname = url.split('?')[0];

  if (pathname === '/' || pathname === '/health' || pathname === '/healthz') {
    const body = JSON.stringify({
      status: 'ok',
      service: 'hf-proxy',
      note: 'Frontend is hosted on Vercel; this Space serves /api',
    });
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-store',
    });
    res.end(body);
    return;
  }

  const target = targetFor(url);
  if (!target) {
    const body = JSON.stringify({ error: 'not_found' });
    res.writeHead(404, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  const headers = Object.assign({}, req.headers, {
    host: `${target.host}:${target.port}`,
    'x-forwarded-host': req.headers.host || '',
    'x-forwarded-proto': 'https',
  });

  const proxyReq = http.request({
    host: target.host,
    port: target.port,
    path: rewritePath(url),
    method: req.method,
    headers,
  });

  proxyReq.on('response', (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => {
    if (!res.headersSent) {
      const body = JSON.stringify({
        error: 'bad_gateway',
        message: 'Dịch vụ nội bộ đang khởi động, vui lòng thử lại sau ít giây.',
      });
      res.writeHead(502, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body),
      });
      res.end(body);
    } else {
      res.destroy();
    }
  });
  req.on('aborted', () => proxyReq.destroy());

  req.pipe(proxyReq, { end: true });
});

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '/';
  const target = targetFor(url);
  if (!target) {
    try { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); } catch (e) {}
    try { socket.destroy(); } catch (e) {}
    return;
  }
  pipeUpgrade(req, socket, head, target);
});

server.on('error', (err) => {
  console.error('[hf-proxy] server error:', err && err.message);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[hf-proxy] listening on 0.0.0.0:${PORT} (backend ${BACKEND.host}:${BACKEND.port}, ai ${AI.host}:${AI.port})`);
});