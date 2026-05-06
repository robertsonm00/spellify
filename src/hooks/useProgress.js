import { useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

const LOCAL_KEY = 'spellify_progress';

const ACTIVITIES = ['wordSearch', 'crossword', 'quiz', 'hangman'];

function emptyStatus() {
  return Object.fromEntries(ACTIVITIES.map(a => [a, { status: 'not_started', accuracy: null, completedAt: null }]));
}

function loadFromLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveToLocal(data) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}

/**
 * useProgress(user)
 * Returns: { getListProgress, markComplete, loading }
 *
 * getListProgress(listId) → { wordSearch, crossword, quiz, hangman }
 *   each value: { status: 'not_started'|'in_progress'|'completed', accuracy, completedAt }
 *
 * markComplete(listId, activity, { accuracy, listType }) → void
 */
export function useProgress(user) {
  // Cache fetched progress in memory so we don't refetch on every render
  const [cache,   setCache]   = useState({});   // { [listId]: { [activity]: {...} } }
  const [loading, setLoading] = useState(false);
  const useCloud = isSupabaseEnabled && !!user;

  // ── Get progress for a list ────────────────────────────────────────────────
  const getListProgress = useCallback(async (listId, listType = 'curriculum') => {
    // Return from memory cache if available
    if (cache[listId]) return cache[listId];

    if (useCloud) {
      setLoading(true);
      const { data, error } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('list_id', listId);
      setLoading(false);
      if (error || !data) return emptyStatus();

      const result = emptyStatus();
      data.forEach(row => {
        if (result[row.activity] !== undefined) {
          result[row.activity] = {
            status:      row.status,
            accuracy:    row.accuracy,
            completedAt: row.completed_at,
          };
        }
      });
      setCache(prev => ({ ...prev, [listId]: result }));
      return result;
    } else {
      const all = loadFromLocal();
      const result = all[listId] || emptyStatus();
      setCache(prev => ({ ...prev, [listId]: result }));
      return result;
    }
  }, [cache, useCloud, user]);

  // ── Mark an activity as complete ───────────────────────────────────────────
  const markComplete = useCallback(async (listId, activity, { accuracy = null, listType = 'curriculum' } = {}) => {
    const now = new Date().toISOString();
    const updated = {
      status:      'completed',
      accuracy,
      completedAt: now,
    };

    // Update local cache immediately for snappy UI
    setCache(prev => ({
      ...prev,
      [listId]: {
        ...(prev[listId] || emptyStatus()),
        [activity]: updated,
      },
    }));

    if (useCloud) {
      // Upsert into progress table
      await supabase.from('progress').upsert({
        user_id:      user.id,
        list_id:      listId,
        list_type:    listType,
        activity,
        status:       'completed',
        accuracy,
        completed_at: now,
      }, { onConflict: 'user_id,list_id,activity' });
    } else {
      const all = loadFromLocal();
      all[listId] = {
        ...(all[listId] || emptyStatus()),
        [activity]: updated,
      };
      saveToLocal(all);
    }
  }, [useCloud, user]);

  // ── Sync helper: get cached progress synchronously (for UI display) ────────
  const getCachedProgress = useCallback((listId) => {
    return cache[listId] || emptyStatus();
  }, [cache]);

  return { getListProgress, markComplete, getCachedProgress, loading };
}
