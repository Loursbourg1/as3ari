// Supabase Edge Function: gemini-proxy
// Securely proxies Gemini API requests from the frontend.
// The API key is stored as a Supabase secret (GEMINI_API_KEY) and is NEVER
// exposed to the browser. The function validates input, forwards to Gemini,
// and returns only the raw model response.
//
// Deploy with:
//   supabase secrets set GEMINI_API_KEY=<your-key>
//   supabase functions deploy gemini-proxy

const MAX_BODY_BYTES = 32_000; // Prompt payloads are small; reject large requests early

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('Gemini') ?? '';

// Models to try in order
const MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash'];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: 'Origin' };
  if (origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.length === 0)) {
    h['Access-Control-Allow-Origin'] = origin ?? '*';
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type';
    h['Access-Control-Max-Age'] = '600';
  }
  return h;
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' }, origin);
  }

  if (!GEMINI_API_KEY) {
    return json(503, { error: 'ai_unavailable', detail: 'Gemini API key not configured' }, origin);
  }

  // Read and size-limit the body
  const contentLength = Number(req.headers.get('Content-Length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json(413, { error: 'payload_too_large' }, origin);
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' }, origin);
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid_json' }, origin);
  }

  // Basic structural validation — must have a non-empty contents array
  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as Record<string, unknown>).contents) ||
    (body as Record<string, unknown[]>).contents.length === 0
  ) {
    return json(400, { error: 'invalid_payload' }, origin);
  }

  // Try each model in order, fall back on 404
  let lastStatus = 500;
  let lastBody = '';
  for (const model of MODELS) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    let geminiRes: Response;
    try {
      geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      return json(502, { error: 'upstream_error', detail: String(err) }, origin);
    }

    lastStatus = geminiRes.status;
    lastBody = await geminiRes.text();

    if (geminiRes.ok) {
      // Return the successful response verbatim
      return new Response(lastBody, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      });
    }

    // Only retry with the next model on 404 (model not found)
    if (geminiRes.status !== 404) break;
  }

  // Return the last error from Gemini
  return json(lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502, {
    error: 'gemini_error',
    detail: lastBody,
  }, origin);
});
