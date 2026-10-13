// Supabase Edge Function: gemini-proxy
// Securely proxies Gemini API requests. API key stored as Supabase secret, never in browser.

const MAX_BODY_BYTES = 32_000;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('Gemini') ?? '';
const MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash'];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Wildcard CORS — security is enforced by the Supabase anon key + Gemini secret, not by origin.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '600',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS });
  }

  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  if (!GEMINI_API_KEY) return json(503, { error: 'ai_unavailable' });

  const raw = await req.text().catch(() => '');
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' });

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'invalid_json' }); }

  if (!Array.isArray((body as Record<string, unknown>).contents)) {
    return json(400, { error: 'invalid_payload' });
  }

  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(
        `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw },
      );
    } catch (err) {
      return json(502, { error: 'upstream_error', detail: String(err) });
    }

    const text = await res.text();
    if (res.ok) {
      return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
    if (res.status !== 404) return json(res.status, { error: 'gemini_error', detail: text });
    // 404 → try next model
  }

  return json(502, { error: 'no_model_available' });
});
