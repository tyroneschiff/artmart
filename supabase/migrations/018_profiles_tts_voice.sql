-- User-selectable Read Aloud voice.
--
-- Stores an ElevenLabs voice_id chosen by the user from the curated
-- list in app/lib/voices.ts. NULL = use the system default (Charlotte).
-- The tts edge function reads this column for authenticated calls;
-- anon callers (preview from picker before save) pass voice_id directly.
--
-- We don't enforce a CHECK constraint against the curated list because
-- we want to be able to add/swap voices in app code without a migration.

alter table public.profiles
  add column if not exists tts_voice_id text;
