/**
 * Public, build-time configuration. Everything here ships to the browser —
 * never put service-role keys or other secrets in VITE_ variables.
 */
const env = import.meta.env;

const supabaseUrl =
  ((env.VITE_SUPABASE_URL || env.SUPABASE_URL) as string | undefined)?.trim() || '';
const supabaseAnonKey =
  ((env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY) as string | undefined)?.trim() || '';
const recaptchaSiteKey =
  ((env.VITE_RECAPTCHA_SITE_KEY || env.RECAPTCHA_SITE_KEY) as string | undefined)?.trim() || '';

const rawDemo = (env.VITE_SHOW_DEMO_DATA ?? env.DEMO_DATA ?? env.SHOW_DEMO_DATA ?? 'true') as string;
const rawRequireEmail = (env.VITE_REQUIRE_EMAIL_VERIFICATION ?? env.REQUIRE_EMAIL_VERIFICATION ?? 'false') as string;

export const config = {
  supabaseUrl,
  supabaseAnonKey,
  recaptchaSiteKey,
  /** Without Supabase credentials the app runs on bundled, clearly-labelled synthetic data. */
  isDemoMode: !supabaseUrl || !supabaseAnonKey,
  showDemoData: rawDemo !== 'false',
  requireEmailVerification: rawRequireEmail === 'true',
  /** 'edge' (default) submits through the submit-report Edge Function; 'rpc' calls the database function directly. */
  submitVia: (env.VITE_SUBMIT_VIA as string | undefined) === 'rpc' ? 'rpc' : 'edge',
  map: {
    tileUrl: (env.VITE_MAP_TILE_URL as string | undefined) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      (env.VITE_MAP_ATTRIBUTION as string | undefined) ||
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
} as const;
