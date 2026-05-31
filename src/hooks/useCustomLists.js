import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

const LOCAL_KEY = 'spellify_custom_lists';

function loadFromLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveToLocal(lists) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(lists));
}

/**
 * useCustomLists(user)
 * Returns: { lists, addList, deleteList, updateList, loading }
 *
 * - Logged-in user with Supabase: CRUD against custom_lists table
 * - Guest: read/write localStorage key 'spellify_custom_lists'
 */
export function useCustomLists(user) {
  const [lists,   setLists]   = useState([]);
  const [loading, setLoading] = useState(false);
  const useCloud = isSupabaseEnabled && !!user;

  // ── Load lists ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (useCloud) {
      setLoading(true);
      supabase
        .from('custom_lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) setLists(data);
          setLoading(false);
        });
    } else {
      setLists(loadFromLocal());
    }
  }, [user, useCloud]);

  // ── Add list ───────────────────────────────────────────────────────────────
  const addList = useCallback(async ({ name, words, testDate = null }) => {
    if (useCloud) {
      // `test_date` is optional metadata and was added to this insert before
      // the column existed on every deployment of the custom_lists table.
      // When it's missing, PostgREST rejects the whole insert and the list
      // silently never saves (the bug behind "new lists never save"). So:
      //   • only send test_date when we actually have one, and
      //   • if the insert is still rejected, retry WITHOUT it so the list
      //     persists regardless. Apply supabase/migrations/*_custom_lists_
      //     test_date.sql to enable cloud test-date persistence.
      const base = { user_id: user.id, name, words };
      let res = await supabase
        .from('custom_lists')
        .insert(testDate != null ? { ...base, test_date: testDate } : base)
        .select()
        .single();
      if (res.error && testDate != null) {
        res = await supabase.from('custom_lists').insert(base).select().single();
      }
      const { data, error } = res;
      if (error) console.error('[customLists] cloud save failed', error);
      if (!error && data) setLists(prev => [data, ...prev]);
      return { error, list: data || null };
    } else {
      const newList = {
        id:         `local-${Date.now()}`,
        name,
        words,
        testDate,                          // optional ISO date, defaults to null
        created_at: new Date().toISOString(),
      };
      const updated = [newList, ...lists];
      saveToLocal(updated);
      setLists(updated);
      return { error: null, list: newList };
    }
  }, [useCloud, user, lists]);

  // ── Delete list ────────────────────────────────────────────────────────────
  const deleteList = useCallback(async (id) => {
    if (useCloud) {
      const { error } = await supabase
        .from('custom_lists')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (!error) setLists(prev => prev.filter(l => l.id !== id));
      return { error };
    } else {
      const updated = lists.filter(l => l.id !== id);
      saveToLocal(updated);
      setLists(updated);
      return { error: null };
    }
  }, [useCloud, user, lists]);

  // ── Update list ────────────────────────────────────────────────────────────
  const updateList = useCallback(async (id, updates) => {
    if (useCloud) {
      const { data, error } = await supabase
        .from('custom_lists')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (!error && data) setLists(prev => prev.map(l => l.id === id ? data : l));
      return { error };
    } else {
      const updated = lists.map(l => l.id === id ? { ...l, ...updates } : l);
      saveToLocal(updated);
      setLists(updated);
      return { error: null };
    }
  }, [useCloud, user, lists]);

  // ── Migrate local lists to Supabase on sign-in ────────────────────────────
  const migrateLocalListsToSupabase = useCallback(async () => {
    if (!useCloud) return;
    const local = loadFromLocal();
    if (local.length === 0) return;
    const rows = local.map(({ name, words }) => ({ user_id: user.id, name, words }));
    const { data, error } = await supabase.from('custom_lists').insert(rows).select();
    if (!error && data) {
      setLists(prev => [...data, ...prev]);
      localStorage.removeItem(LOCAL_KEY);
    }
  }, [useCloud, user]);

  return { lists, addList, deleteList, updateList, migrateLocalListsToSupabase, loading };
}
