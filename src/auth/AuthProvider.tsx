import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthValue {
  /** False in demo mode (no backend configured). */
  available: boolean;
  loading: boolean;
  session: Session | null;
  email: string | null;
  emailVerified: boolean;
  signInWithPassword(email: string, password: string): Promise<boolean>;
  signUp(email: string, password: string, next: string): Promise<boolean>;
  sendMagicLink(email: string, next: string): Promise<boolean>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function callbackUrl(next: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
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
  }, []);

  const value = useMemo<AuthValue>(() => {
    const user = session?.user ?? null;
    return {
      available: Boolean(supabase),
      loading,
      session,
      email: user?.email ?? null,
      emailVerified: Boolean(user?.email_confirmed_at),
      async signInWithPassword(email, password) {
        if (!supabase) return false;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return !error;
      },
      async signUp(email, password, next) {
        if (!supabase) return false;
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl(next) } });
        return !error;
      },
      async sendMagicLink(email, next) {
        if (!supabase) return false;
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true } });
        return !error;
      },
      async signOut() {
        await supabase?.auth.signOut();
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
