// Serves dist/ with the same security headers and SPA rewrite as vercel.json,
// so end-to-end tests run under the production Content-Security-Policy.
// Usage: node scripts/serve-dist.mjs [port]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve('dist');
const port = Number(process.argv[2] ?? 4173);
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const globalHeaders = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]));
// Local tests run over http; drop the https upgrade so the browser does not rewrite requests.
globalHeaders['Content-Security-Policy'] = globalHeaders['Content-Security-Policy'].replace('; upgrade-insecure-requests', '');
delete globalHeaders['Strict-Transport-Security'];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root)) {
    res.writeHead(400).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  res.writeHead(200, { ...globalHeaders, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`serving dist on http://localhost:${port}`));
