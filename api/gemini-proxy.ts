import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.Gemini ?? process.env.GEMINI_API_KEY ?? '';
const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_BODY_BYTES = 32_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!GEMINI_API_KEY) return res.status(503).json({ error: 'ai_unavailable' });

  const raw = JSON.stringify(req.body);
  if (raw.length > MAX_BODY_BYTES) return res.status(413).json({ error: 'payload_too_large' });

  if (!Array.isArray(req.body?.contents)) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  let lastError = '';
  for (const model of MODELS) {
    let upstream: Response;
    try {
      upstream = await fetch(
        `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw },
      );
    } catch (err) {
      return res.status(502).json({ error: 'upstream_error', detail: String(err) });
    }

    const text = await upstream.text();
    if (upstream.ok) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(text);
    }
    lastError = `${model}: ${upstream.status} ${text.slice(0, 200)}`;
    if (upstream.status !== 404) return res.status(upstream.status).json({ error: 'gemini_error', detail: text });
  }

  return res.status(502).json({ error: 'no_model_available', tried: MODELS, lastError });
}
