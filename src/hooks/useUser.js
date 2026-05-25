import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

/**
 * useUser()
 * Returns: { user, profile, signIn, signUp, signInWithGoogle, signOut, loading, error }
 *
 * When Supabase is not configured:
 *   - user is always null
 *   - all auth functions are friendly no-ops that resolve immediately
 *   - no errors thrown
 */
export function useUser() {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseEnabled);
  const [error,   setError]   = useState(null);

  // ── Fetch profile row from Supabase ────────────────────────────────────────
  const fetchProfile = useCallback(async (userId) => {
    if (!isSupabaseEnabled || !userId) return;
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!err && data) setProfile(data);
  }, []);

  // ── On mount: restore session ──────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseEnabled) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id);
      else    setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── Sign up ────────────────────────────────────────────────────────────────
  const signUp = useCallback(async ({ email, password, displayName, yearGroup }) => {
    if (!isSupabaseEnabled) return { error: new Error('Auth not configured') };
    setError(null);
    const { data, error: authErr } = await supabase.auth.signUp({ email, password });
    if (authErr) { setError(authErr.message); return { error: authErr }; }

    // Insert profile row
    if (data.user) {
      const { error: profileErr } = await supabase.from('profiles').insert({
        id:           data.user.id,
        display_name: displayName || email.split('@')[0],
        year_group:   yearGroup   || null,
      });
      if (profileErr) console.warn('Profile insert failed:', profileErr.message);
      await fetchProfile(data.user.id);
    }
    return { error: null };
  }, [fetchProfile]);

  // ── Sign in ────────────────────────────────────────────────────────────────
  const signIn = useCallback(async ({ email, password }) => {
    if (!isSupabaseEnabled) return { error: new Error('Auth not configured') };
    setError(null);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) { setError(authErr.message); return { error: authErr }; }
    return { error: null };
  }, []);

  // ── Google OAuth ───────────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseEnabled) return { error: new Error('Auth not configured') };
    setError(null);
    const { error: authErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: window.location.origin },
    });
    if (authErr) { setError(authErr.message); return { error: authErr }; }
    return { error: null };
  }, []);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (!isSupabaseEnabled) return;
    // scope: 'local' so the on-device session clears even when the
    // server-side revoke fails (offline / slow network / expired
    // token). Without this the sb-* localStorage keys survive and
    // getSession() restores the email on the next render.
    try { await supabase.auth.signOut({ scope: 'local' }); }
    catch { /* network failed — local clear below covers it */ }
    setUser(null);
    setProfile(null);
    // Belt-and-braces: nuke any leftover Supabase auth keys directly
    // in case the SDK didn't get to them (older versions, quota, etc).
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-'))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }, []);

  return { user, profile, signIn, signUp, signInWithGoogle, signOut, loading, error };
}
