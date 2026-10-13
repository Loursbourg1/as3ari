// Supabase Edge Function: gemini-proxy
// Securely proxies Gemini API requests. API key stored as Supabase secret, never in browser.

const MAX_BODY_BYTES = 32_000;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('Gemini') ?? '';
const MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash'];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://as3ari.vercel.app')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: origin && ALLOWED_ORIGINS.includes(origin) ? 204 : 403, headers: corsHeaders(origin) });
  }
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json(403, { error: 'not_allowed' }, origin);

  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);

  if (!GEMINI_API_KEY) return json(503, { error: 'ai_unavailable' }, origin);

  const raw = await req.text().catch(() => '');
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' }, origin);

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'invalid_json' }, origin); }

  if (!Array.isArray((body as Record<string, unknown>).contents)) {
    return json(400, { error: 'invalid_payload' }, origin);
  }

  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(
        `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw },
      );
    } catch (err) {
      return json(502, { error: 'upstream_error' }, origin);
    }

    const text = await res.text();
    if (res.ok) {
      return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
    }
    if (res.status !== 404) return json(res.status, { error: 'gemini_error' }, origin);
    // 404 → try next model
  }

  return json(502, { error: 'no_model_available' }, origin);
});
