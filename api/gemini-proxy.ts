import type { VercelRequest, VercelResponse } from '@vercel/node';

const KEY = process.env.Gemini ?? process.env.GEMINI_API_KEY ?? '';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_BODY = 32_000;

// Keep a known-current Flash model first so transient model-list failures do not
// take the planner offline. The list response is used to verify availability.
const PREFERRED_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

/** List models enabled for this key and order them with current Flash models first. */
async function resolveModels(): Promise<string[]> {
  const res = await fetch(`${BASE}/models?key=${encodeURIComponent(KEY)}&pageSize=100`);
  if (!res.ok) return [];
  const body = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const usable = (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  return [
    ...PREFERRED_MODELS.filter((model) => usable.includes(model)),
    ...usable.filter((model) => model.includes('flash') && !PREFERRED_MODELS.includes(model)),
    ...usable.filter((model) => model.includes('pro')),
    ...usable.filter((model) => !model.includes('flash') && !model.includes('pro')),
  ];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!KEY) return res.status(503).json({ error: 'ai_unavailable' });

  const raw = JSON.stringify(req.body);
  if (!raw || raw.length > MAX_BODY) return res.status(413).json({ error: 'payload_too_large' });
  if (!Array.isArray(req.body?.contents)) return res.status(400).json({ error: 'invalid_payload' });

  const listedModels = await resolveModels().catch(() => []);
  // Try preferred models even when discovery fails (the key may still have
  // access while Google's model-list endpoint is temporarily unavailable).
  const models = [...new Set([...PREFERRED_MODELS, ...listedModels])];
  let lastStatus = 503;
  let lastDetail = 'No Gemini model could be reached';

  for (const model of models) {
    let upstream: Response;
    try {
      upstream = await fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw,
      });
    } catch (err: unknown) {
      lastDetail = String(err).slice(0, 300);
      continue;
    }

    const text = await upstream.text();
    if (upstream.ok) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(text);
    }

    lastStatus = upstream.status;
    lastDetail = text.slice(0, 300);
    // A model can exist but be unavailable to this key or temporarily busy.
    // Try another candidate for model/availability/quota errors only.
    if (![400, 403, 404, 429, 503].includes(upstream.status)) break;
  }

  if (models.length === 0) return res.status(503).json({ error: 'no_model_available' });
  return res.status(lastStatus).json({ error: 'gemini_error', detail: lastDetail });
}
