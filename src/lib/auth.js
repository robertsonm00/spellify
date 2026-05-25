// Auth service — thin wrapper around supabase.auth.*.
//
// The profile row is created automatically by a DB trigger on
// auth.users insert, so signUp() does NOT manually insert.
//
// When Supabase isn't configured (no env vars), every function returns
// a friendly no-op shape so guest mode still works end-to-end. This is
// intentional — auth is an enhancement, not a gate.

import { supabase, isSupabaseEnabled } from './supabase';

const notConfigured = (extra = {}) => ({
  data: null,
  error: new Error('Supabase auth is not configured'),
  ...extra,
});

export async function signUp(email, password) {
  if (!isSupabaseEnabled) return notConfigured();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Send the user back to the app after they confirm their email.
      emailRedirectTo: window.location.origin,
    },
  });
  return { data, error };
}

export async function signIn(email, password) {
  if (!isSupabaseEnabled) return notConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  if (!isSupabaseEnabled) return { error: null };
  // scope: 'local' clears the on-device session immediately even if
  // the server-side revoke request fails (offline, slow network, or
  // the access token is already expired). Without this, the cached
  // sb-* keys survive and getSession() restores the user on the next
  // tick — which presented as "I signed out but my email is still
  // there when I click Quick Start."
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  return { error };
}

export async function resetPassword(email) {
  if (!isSupabaseEnabled) return notConfigured();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?reset=1`,
  });
  return { data, error };
}

export async function getSession() {
  if (!isSupabaseEnabled) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session ?? null;
}

/**
 * Subscribe to auth state changes. Returns an unsubscribe function.
 *
 *   const unsub = onAuthStateChange((session) => { ... });
 *   ... later: unsub();
 */
export function onAuthStateChange(callback) {
  if (!isSupabaseEnabled) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event); // pass both through
  });
  return () => data?.subscription?.unsubscribe?.();
}
