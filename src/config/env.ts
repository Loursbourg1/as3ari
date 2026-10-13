/**
 * Public, build-time configuration. Everything here ships to the browser —
 * never put service-role keys or other secrets in VITE_ variables.
 */
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

export const config = {
  supabaseUrl,
  supabaseAnonKey,
  recaptchaSiteKey,
  get hasGeminiAi(): boolean {
    // Gemini is available through the same-origin Vercel function in deployments.
    // The secret is never included in the browser bundle.
    return !import.meta.env.DEV;
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
