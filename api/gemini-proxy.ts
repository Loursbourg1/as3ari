import type { VercelRequest, VercelResponse } from '@vercel/node';

const KEY = process.env.Gemini ?? process.env.GEMINI_API_KEY ?? '';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_BODY = 32_000;

// Cached across warm invocations — avoids a discovery call on every request.
let activeModel: string | null = null;

/** Ask Google which models this key can actually use, pick the best flash/pro available. */
async function resolveModel(): Promise<string | null> {
  if (activeModel) return activeModel;
  const res = await fetch(`${BASE}/models?key=${encodeURIComponent(KEY)}&pageSize=100`);
  if (!res.ok) return null;
  const body = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const usable = (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  // Prefer flash variants (cheaper + faster), then anything
  activeModel =
    usable.find((n) => n.includes('flash')) ??
    usable.find((n) => n.includes('pro')) ??
    usable[0] ??
    null;
  return activeModel;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!KEY) return res.status(503).json({ error: 'ai_unavailable' });

  const raw = JSON.stringify(req.body);
  if (!raw || raw.length > MAX_BODY) return res.status(413).json({ error: 'payload_too_large' });
  if (!Array.isArray(req.body?.contents)) return res.status(400).json({ error: 'invalid_payload' });

  const model = await resolveModel().catch(() => null);
  if (!model) return res.status(503).json({ error: 'no_model_available' });

  const upstream = await fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw,
  }).catch((err: unknown) => { throw new Error(String(err)); });

  // If model suddenly gone, clear cache and retry once with fresh discovery
  if (upstream.status === 404) {
    activeModel = null;
    const retry = await resolveModel().catch(() => null);
    if (retry && retry !== model) {
      const r2 = await fetch(`${BASE}/models/${retry}:generateContent?key=${encodeURIComponent(KEY)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw,
      });
      const t2 = await r2.text();
      if (r2.ok) { res.setHeader('Content-Type', 'application/json'); return res.status(200).send(t2); }
      return res.status(r2.status).json({ error: 'gemini_error', detail: t2.slice(0, 300) });
    }
    return res.status(503).json({ error: 'no_model_available' });
  }

  const text = await upstream.text();
  if (!upstream.ok) return res.status(upstream.status).json({ error: 'gemini_error', detail: text.slice(0, 300) });

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).send(text);
}
