-- Generative video clips (Phase 1 of growth/video-clips-plan.md).
-- A published piece can be animated into a short clip via fal.ai
-- image-to-video. These columns track that per-piece state. All
-- nullable/defaulted so existing rows and the create→publish flow are
-- untouched.
--
--   clip_status: none | queued | processing | ready | failed
--   clip_url:    final (optionally watermarked) MP4 once ready
--   clip_prompt: the per-image motion prompt we generated
--   clip_requested_at: when generation was kicked off (debounce/rate-limit)

alter table public.pieces
  add column if not exists clip_status text not null default 'none',
  add column if not exists clip_url text,
  add column if not exists clip_prompt text,
  add column if not exists clip_requested_at timestamptz;
