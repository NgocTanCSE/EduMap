/**
 * EduMap Mobile (Web) — lightweight static server for Hugging Face Spaces.
 *
 * Expo's `export:web` produces a static `web-build/` directory. This server
 * serves it with a SPA fallback (any unknown route → index.html) on the port
 * HF requires (7860 by default, overridable via PORT).
 *
 * No runtime dependencies — uses only Node's built-in modules so the final
 * image stays tiny and needs no package install at runtime.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'web-build');
const PORT = process.env.PORT || 7860;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function sendFile(res, filePath, stat) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  // Hashed assets (expo emits [name].[hash].js) can be cached long-term.
  const isHashed = /\.[a-f0-9]{6,}\./.test(path.basename(filePath));
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': isHashed ? 'public, max-age=31536000, immutable' : 'public, max-age=0',
  });
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

function notFound(res) {
  fs.readFile(path.join(ROOT, 'index.html'), (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

function handleRequest(req, res) {
  if (req.headers['x-health-check'] === 'true' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"status":"ok"}');
    return;
  }

  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.normalize(path.join(ROOT, urlPath));
  // Prevent path traversal outside web-build.
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return notFound(res);
    sendFile(res, filePath, stat);
  });
}

const server = http.createServer(handleRequest);
server.listen(PORT, HOST, () => {
  console.log(`[server] EduMap mobile-web serving ${ROOT} on http://${HOST}:${PORT}`);
});
