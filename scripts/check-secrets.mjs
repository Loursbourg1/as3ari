// Repository and client-bundle secret check.
// Fails if it finds privileged credentials in tracked source files or in dist/.
// Usage: npm run check:secrets
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const findings = [];

function decodeJwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

const RULES = [
  { name: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'service-role key assignment', re: /SERVICE_ROLE(_KEY)?\s*[=:]\s*['"]?[A-Za-z0-9._-]{20,}/ },
  { name: 'database URL with password', re: /postgres(ql)?:\/\/[^:\s/]+:[^@\s]{6,}@/ },
  { name: 'generic API secret assignment', re: /(api[_-]?secret|secret[_-]?key)\s*[=:]\s*['"][A-Za-z0-9/_+-]{20,}['"]/i },
];

function scan(file, text, { bundle = false } = {}) {
  for (const r of RULES) if (r.re.test(text)) findings.push(`${file}: ${r.name}`);
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) {
    const role = decodeJwtRole(m[0]);
    if (role === 'service_role') findings.push(`${file}: service_role JWT`);
    else if (!bundle) findings.push(`${file}: JWT committed to source (role: ${role ?? 'unknown'})`);
  }
}

// 1. Tracked files (falls back to a filesystem walk if git is unavailable).
let files = [];
try {
  files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch {
  files = [];
}
for (const f of files) {
  if (/(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.env.example')) findings.push(`${f}: environment file is tracked`);
  if (!existsSync(f) || statSync(f).size > 2_000_000 || /\.(png|jpg|woff2?|ico|zip)$/.test(f) || f === 'package-lock.json') continue;
  scan(f, readFileSync(f, 'utf8'));
}

// 2. Built client bundle: no privileged keys may ever ship to browsers.
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
if (existsSync('dist')) for (const f of walk('dist').filter((f) => /\.(js|html|css|json|map)$/.test(f))) scan(f, readFileSync(f, 'utf8'), { bundle: true });

if (findings.length) {
  console.error(`Secret check FAILED (${findings.length}):\n  ${findings.join('\n  ')}`);
  process.exit(1);
}
console.log(`Secret check passed: ${files.length} tracked/untracked source files${existsSync('dist') ? ' and dist/' : ''} scanned.`);
