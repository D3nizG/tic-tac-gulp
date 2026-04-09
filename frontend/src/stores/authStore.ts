import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, supabaseEnabled } from '../lib/supabase.js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;

  /** Sign in with Google OAuth (redirects). */
  signInWithGoogle: () => Promise<void>;

  /** Sign in with email + password. */
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;

  /** Sign up with email + password. */
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;

  /** Sign out. */
  signOut: () => Promise<void>;

  /** Returns the current access token for attaching to API requests. */
  getToken: () => string | null;

  /** Internal: called by auth state listener. */
  _setAuth: (user: User | null, session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: supabaseEnabled, // true only while Supabase resolves the initial session

  signInWithGoogle: async () => {
    if (!supabaseEnabled) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  },

  signInWithEmail: async (email, password) => {
    if (!supabaseEnabled) return { error: 'Auth not configured' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },

  signUpWithEmail: async (email, password) => {
    if (!supabaseEnabled) return { error: 'Auth not configured' };
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    if (!supabaseEnabled) return;
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },

  getToken: () => get().session?.access_token ?? null,

  _setAuth: (user, session) => set({ user, session, loading: false }),
}));

// Subscribe to Supabase auth state changes
if (supabaseEnabled) {
  supabase.auth.getSession().then(({ data }) => {
    useAuthStore.getState()._setAuth(data.session?.user ?? null, data.session);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState()._setAuth(session?.user ?? null, session);
  });
}
