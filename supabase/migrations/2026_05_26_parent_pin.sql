-- 2026-05-26  Parent PIN gate
--
-- Adds a hashed 4-digit PIN to the parent's `profiles` row. The PIN
-- protects the grown-up area of the app from accidental access by a
-- child — it isn't security against a determined attacker, but it
-- matches the Netflix-style "kids profile vs adults profile" pattern.
--
-- Hashing is done client-side with PBKDF2-SHA256 (100k iterations,
-- the user's auth.uid as salt). The server only ever sees the hex
-- digest — never the PIN. Verification recomputes the hash and
-- compares. See src/lib/pin.js for the implementation.
--
-- Run in the Supabase SQL Editor. Idempotent.

alter table public.profiles
  add column if not exists parent_pin_hash text;

comment on column public.profiles.parent_pin_hash is
  'Hex-encoded PBKDF2-SHA256 hash of the grown-up area PIN. NULL means no PIN set (open access for now). Salt = profiles.id.';

-- Sanity check after running:
--   select id, display_name, (parent_pin_hash is not null) as has_pin
--   from public.profiles where id = auth.uid();
