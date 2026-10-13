/**
 * Public, build-time configuration. Everything here ships to the browser —
 * never put service-role keys or other secrets in VITE_ variables.
 */
declare const __GEMINI_API_KEY__: string | undefined;

// Direct static access is required for Vite production AST replacement
const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '').trim();
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '').trim();

// Google reCAPTCHA site key (falls back to Google official test site key so widget is always visible)
const recaptchaSiteKey =
  (import.meta.env.VITE_RECAPTCHA_SITE_KEY || import.meta.env.RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI').trim();

const rawDemo = (import.meta.env.VITE_SHOW_DEMO_DATA ?? import.meta.env.DEMO_DATA ?? import.meta.env.SHOW_DEMO_DATA ?? 'true');
const rawRequireEmail = (import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION ?? import.meta.env.REQUIRE_EMAIL_VERIFICATION ?? 'false');

export function getGeminiApiKey(): string {
  const envKey = (
    (typeof __GEMINI_API_KEY__ !== 'undefined' ? __GEMINI_API_KEY__ : '') ||
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    (import.meta.env.GEMINI_API_KEY as string | undefined) ||
    (import.meta.env.Gemini as string | undefined) ||
    (import.meta.env.VITE_Gemini as string | undefined) ||
    (import.meta.env.GEMINI as string | undefined) ||
    ''
  ).trim();
  if (envKey) return envKey;
  try {
    return (localStorage.getItem('as3ari.gemini_key') || '').trim();
  } catch {
    return '';
  }
}

export function setLocalGeminiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem('as3ari.gemini_key', key.trim());
    } else {
      localStorage.removeItem('as3ari.gemini_key');
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export const config = {
  supabaseUrl,
  supabaseAnonKey,
  recaptchaSiteKey,
  get geminiApiKey(): string {
    return getGeminiApiKey();
  },
  get hasGeminiAi(): boolean {
    // The Gemini key lives in Supabase secrets (server-side). AI is available
    // whenever Supabase is configured; the proxy returns 503 if not set.
    return Boolean(supabaseUrl && supabaseAnonKey);
  },
  /** Without Supabase credentials the app runs on bundled, clearly-labelled synthetic data. */
  isDemoMode: !supabaseUrl || !supabaseAnonKey,
  showDemoData: rawDemo !== 'false',
  requireEmailVerification: rawRequireEmail === 'true',
  /** 'edge' (default) submits through the submit-report Edge Function; 'rpc' calls the database function directly. */
  submitVia: (import.meta.env.VITE_SUBMIT_VIA as string | undefined) === 'rpc' ? 'rpc' : 'edge',
  map: {
    tileUrl: (import.meta.env.VITE_MAP_TILE_URL as string | undefined) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined) ||
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
} as const;
