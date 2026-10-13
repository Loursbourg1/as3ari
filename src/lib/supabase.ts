import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env';
import { platform } from '../platform/platform';

/** The browser client uses only the public anon key; RLS and database functions enforce access. */
export const supabase: SupabaseClient | null = config.isDemoMode
  ? null
  : createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: platform.authStorage,
      },
    });
