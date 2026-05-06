import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.REACT_APP_SUPABASE_URL     || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseEnabled = !!supabase;

/*
 * ── Supabase SQL Setup ──────────────────────────────────────────────────────
 * Run the following in your Supabase SQL Editor (Settings → SQL Editor)
 * before enabling auth features.
 *
 * -- profiles table
 * create table profiles (
 *   id uuid references auth.users on delete cascade primary key,
 *   display_name text not null,
 *   year_group integer,
 *   created_at timestamp with time zone default timezone('utc'::text, now())
 * );
 * alter table profiles enable row level security;
 * create policy "Users can read own profile"   on profiles for select using (auth.uid() = id);
 * create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
 * create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
 *
 * -- custom_lists table
 * create table custom_lists (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references profiles(id) on delete cascade not null,
 *   name text not null,
 *   words jsonb not null default '[]',
 *   created_at timestamp with time zone default timezone('utc'::text, now())
 * );
 * alter table custom_lists enable row level security;
 * create policy "Users can manage own lists" on custom_lists
 *   using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * -- progress table
 * create table progress (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references profiles(id) on delete cascade not null,
 *   list_id text not null,            -- curriculum list id or custom_list uuid
 *   list_type text not null,          -- 'curriculum' | 'custom'
 *   activity text not null,           -- 'wordSearch' | 'crossword' | 'quiz' | 'hangman'
 *   status text not null default 'not_started',
 *   accuracy integer,
 *   completed_at timestamp with time zone
 * );
 * alter table progress enable row level security;
 * create policy "Users can manage own progress" on progress
 *   using (auth.uid() = user_id) with check (auth.uid() = user_id);
 */
