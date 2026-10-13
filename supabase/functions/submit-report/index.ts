// Supabase Edge Function: submit-report
// Validates an untrusted price report (Zod), checks authentication and email
// verification, then calls the submit_price_report() database function *as the
// caller* (user JWT, anon key). The database remains the final authority: it derives
// the reporter id, normalizes the price, enforces rate limits and duplicate checks,
// and always stores the report as 'pending'. No service-role key is used here.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { priceReportInput, toReportErrorCode } from '../_shared/reportSchema.ts';

const MAX_BODY_BYTES = 2_600_000;
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://as3ari.vercel.app')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) ? origin : 'https://as3ari.vercel.app';
  return {
    'Vary': 'Origin',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}

const STATUS_FOR: Record<string, number> = {
  not_authenticated: 401,
  email_not_verified: 403,
  not_allowed: 403,
  duplicate_report: 409,
  rate_limited: 429,
  captcha_required: 400,
  captcha_failed: 400,
  server_error: 500,
};

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: origin && ALLOWED_ORIGINS.includes(origin) ? 204 : 403, headers: corsHeaders(origin) });
  }
  // CORS is not authentication, but browsers from unknown origins are refused outright.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json(403, { error: 'not_allowed' }, origin);
  if (req.method !== 'POST') return json(405, { error: 'invalid_input' }, origin);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'not_authenticated' }, origin);
  if (!(req.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) {
    return json(415, { error: 'invalid_input' }, origin);
  }
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) return json(413, { error: 'invalid_input' }, origin);

  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json(413, { error: 'invalid_input' }, origin);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid_input' }, origin);
  }
  const parsed = priceReportInput.safeParse(body);
  if (!parsed.success) return json(400, { error: 'invalid_input' }, origin);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json(401, { error: 'not_authenticated' }, origin);

  const requireEmail = (Deno.env.get('REQUIRE_EMAIL_VERIFICATION') ?? 'false') === 'true';
  if (requireEmail && !userData.user.email_confirmed_at) {
    return json(403, { error: 'email_not_verified' }, origin);
  }

  const v = parsed.data;

  // Google reCAPTCHA verification if secret key is configured on server
  const recaptchaSecret = Deno.env.get('RECAPTCHA_SECRET_KEY');
  if (recaptchaSecret) {
    if (!v.recaptcha_token) {
      return json(400, { error: 'captcha_required' }, origin);
    }
    try {
      const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: recaptchaSecret,
          response: v.recaptcha_token,
          remoteip: req.headers.get('x-forwarded-for') ?? '',
        }),
      });
      const verifyData = (await verifyRes.json()) as { success?: boolean };
      if (!verifyData.success) {
        return json(400, { error: 'captcha_failed' }, origin);
      }
    } catch {
      return json(500, { error: 'server_error' }, origin);
    }
  }

  let data: unknown;
  let error: { message?: string } | null = null;

  if (v.location_label && !v.shop_id) {
    const res = await supabase.rpc('submit_report_with_location', {
      p_product_id: v.product_id,
      p_price: v.price,
      p_quantity: v.quantity,
      p_unit: v.unit,
      p_observed_on: v.observed_on,
      p_location_label: v.location_label,
      p_lat: v.lat ?? null,
      p_lng: v.lng ?? null,
      p_photo_url: v.photo_url ?? null,
      p_is_anonymous: v.is_anonymous ?? true,
      p_reporter_name: v.is_anonymous ? null : (v.reporter_name ?? null),
    });
    data = res.data;
    error = res.error;
  } else {
    const res = await supabase.rpc('submit_price_report', {
      p_product_id: v.product_id,
      p_shop_id: v.shop_id,
      p_price: v.price,
      p_quantity: v.quantity,
      p_unit: v.unit,
      p_observed_on: v.observed_on,
      p_is_anonymous: v.is_anonymous ?? true,
      p_reporter_name: v.is_anonymous ? null : (v.reporter_name ?? null),
    });
    data = res.data;
    error = res.error;
  }

  if (error) {
    const code = toReportErrorCode(error.message);
    return json(STATUS_FOR[code] ?? 400, { error: code }, origin);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return json(
    200,
    { id: row.id, status: row.status, normalized_price: String(row.normalized_price), comparison_unit: row.comparison_unit },
    origin,
  );
});
