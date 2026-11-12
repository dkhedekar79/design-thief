/**
 * Production server for Design Thief: serves the built SPA and the /api/analyze
 * endpoint with no framework, so `npm run build && npm start` is enough.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeUrl, AnalyzeError } from './analyze.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..', 'dist');
const port = Number(process.env.PORT ?? 3000);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20000) break;
  }
  return raw;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/api/analyze') {
    if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' });
    let target = '';
    try {
      target = JSON.parse((await readBody(req)) || '{}').url ?? '';
    } catch {
      target = '';
    }
    try {
      return json(res, 200, await analyzeUrl(target));
    } catch (error) {
      const known = error instanceof AnalyzeError;
      return json(res, known ? error.status : 500, {
        error: known ? error.message : 'Could not read that site. Try another address.',
      });
    }
  }

  if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Unknown endpoint.' });

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(root, normalize(requested).replace(/^(\.\.[/\\])+/, ''));
  const safePath = filePath.startsWith(root) ? filePath : join(root, 'index.html');
  const fallback = existsSync(safePath) ? safePath : join(root, 'index.html');
  try {
    const file = await readFile(fallback);
    res.writeHead(200, { 'content-type': contentTypes[extname(fallback)] ?? 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Run `npm run build` before `npm start`.');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Design Thief running on http://localhost:${port}`);
});
