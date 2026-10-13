import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { readJson, writeJson } from '../platform/platform';

interface LocalUser {
  id: string;
  email: string;
  email_confirmed_at: string;
}

const LOCAL_AUTH_KEY = 'as3ari.local_auth_session';

interface AuthValue {
  /** True when auth is available (always true now with local fallback). */
  available: boolean;
  loading: boolean;
  session: Session | null;
  email: string | null;
  username: string | null;
  emailVerified: boolean;
  signInWithPassword(email: string, password: string): Promise<{ ok: boolean; error?: string }>;
  signUp(email: string, password: string, next: string): Promise<{ ok: boolean; session?: boolean; error?: string }>;
  sendMagicLink(email: string, next: string): Promise<{ ok: boolean; error?: string }>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function callbackUrl(next: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabase) {
      let active = true;
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      });
      const { data } = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s);
        setLoading(false);
      });
      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    } else {
      // Local fallback for offline / local-test mode
      const saved = readJson<LocalUser | null>(LOCAL_AUTH_KEY, null);
      if (saved) {
        setSession({
          user: {
            id: saved.id,
            email: saved.email,
            email_confirmed_at: saved.email_confirmed_at,
          } as SupabaseUser,
          access_token: 'local-test-token',
        } as Session);
      }
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthValue>(() => {
    const user = session?.user ?? null;
    const username =
      (user?.user_metadata?.username as string | undefined) ||
      (user?.email ? user.email.split('@')[0]?.replace(/[^a-zA-Z0-9_-]/g, '') : null) ||
      null;
    return {
      available: true,
      loading,
      session,
      email: user?.email ?? null,
      username,
      emailVerified: Boolean(user?.email_confirmed_at),
      async signInWithPassword(email, password) {
        if (supabase) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('rate limit') || msg.includes('too many')) {
              return { ok: false, error: 'Too many attempts. Please wait a few minutes before trying again.' };
            }
            if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong password')) {
              return { ok: false, error: 'Incorrect email or password.' };
            }
            return { ok: false, error: error.message };
          }
          return { ok: true };
        }
        // Local authentication fallback
        const localUser: LocalUser = {
          id: 'usr_' + btoa(email).slice(0, 16),
          email,
          email_confirmed_at: new Date().toISOString(),
        };
        writeJson(LOCAL_AUTH_KEY, localUser);
        setSession({
          user: {
            id: localUser.id,
            email: localUser.email,
            email_confirmed_at: localUser.email_confirmed_at,
          } as SupabaseUser,
          access_token: 'local-test-token',
        } as Session);
        return { ok: true };
      },
      async signUp(email, password, next) {
        if (supabase) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: callbackUrl(next) },
          });
          if (error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('over_email_send_rate_limit')) {
              return { ok: false, error: 'Email rate limit reached. Please wait a few minutes, or use the magic-link option below.' };
            }
            if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already')) {
              return { ok: false, error: 'This email is already registered — try signing in instead.' };
            }
            return { ok: false, error: error.message };
          }
          // Supabase returns an empty identities list for an already registered
          // account. Do not leave the person waiting for another confirmation email.
          if (data?.user?.identities && data.user.identities.length === 0) {
            return { ok: false, error: 'An account already exists for this email — sign in or reset your password.' };
          }
          // If Supabase has email confirmation disabled, session is returned immediately
          if (data?.session) {
            setSession(data.session);
          }
          return { ok: true, session: Boolean(data?.session) };
        }
        // Local signup fallback (instantly verified for seamless local testing)
        const localUser: LocalUser = {
          id: 'usr_' + btoa(email).slice(0, 16),
          email,
          email_confirmed_at: new Date().toISOString(),
        };
        writeJson(LOCAL_AUTH_KEY, localUser);
        setSession({
          user: {
            id: localUser.id,
            email: localUser.email,
            email_confirmed_at: localUser.email_confirmed_at,
          } as SupabaseUser,
          access_token: 'local-test-token',
        } as Session);
        return { ok: true, session: true };
      },
      async sendMagicLink(email, next) {
        if (supabase) {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true },
          });
          if (error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('rate limit') || msg.includes('too many')) {
              return { ok: false, error: 'Email rate limit reached. Please wait a few minutes before trying again.' };
            }
            return { ok: false, error: error.message };
          }
          return { ok: true };
        }
        const localUser: LocalUser = {
          id: 'usr_' + btoa(email).slice(0, 16),
          email,
          email_confirmed_at: new Date().toISOString(),
        };
        writeJson(LOCAL_AUTH_KEY, localUser);
        setSession({
          user: {
            id: localUser.id,
            email: localUser.email,
            email_confirmed_at: localUser.email_confirmed_at,
          } as SupabaseUser,
          access_token: 'local-test-token',
        } as Session);
        return { ok: true };
      },
      async signOut() {
        if (supabase) {
          await supabase.auth.signOut();
        } else {
          writeJson(LOCAL_AUTH_KEY, null);
          setSession(null);
        }
      },
    };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
