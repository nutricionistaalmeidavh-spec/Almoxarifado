import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/web');
const PROJECT_ROOT = path.resolve(ROOT, '../..');
const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8']
]);
const VENDOR_FILES = new Map([
  ['/vendor/html5-qrcode.min.js', [
    path.join(PROJECT_ROOT, 'node_modules/html5-qrcode/html5-qrcode.min.js'),
    path.join(PROJECT_ROOT, 'node_modules/html5-qrcode/dist/html5-qrcode.min.js')
  ]]
]);

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  if (VENDOR_FILES.has(clean)) {
    for (const candidate of VENDOR_FILES.get(clean)) {
      try { if ((await stat(candidate)).isFile()) return candidate; } catch {}
    }
    return null;
  }
  const requested = clean === '/' ? '/index.html' : clean;
  const candidate = path.resolve(ROOT, `.${requested}`);
  if (!candidate.startsWith(`${ROOT}${path.sep}`) && candidate !== ROOT) return null;
  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
  } catch {}
  return path.join(ROOT, 'index.html');
}

export function createWebServer({ host = '0.0.0.0', port = 4173, apiHandler = null } = {}) {
  if (typeof host !== 'string' || !host.trim()) throw new TypeError('host is required');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RangeError('port is invalid');
  if (apiHandler != null && typeof apiHandler !== 'function') throw new TypeError('apiHandler must be a function');

  const server = http.createServer(async (req, res) => {
    if ((req.url || '').startsWith('/api/')) {
      if (!apiHandler) {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'API_UNAVAILABLE' }));
        return;
      }
      await apiHandler(req, res);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    try {
      const file = await resolveFile(req.url || '/');
      if (!file) {
        res.writeHead(404).end();
        return;
      }
      const body = await readFile(file);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', TYPES.get(path.extname(file)) || 'application/octet-stream');
      res.writeHead(200);
      if (req.method === 'HEAD') res.end(); else res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });

  return {
    start: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        resolve();
      });
    }),
    stop: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    address: () => server.address()
  };
}
