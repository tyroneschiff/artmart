-- Drop the FK constraint added in 022 while keeping the column.
--
-- WHY: stores.cover_piece_id → pieces.id created a SECOND foreign-key
-- relationship between the stores and pieces tables. PostgREST then
-- couldn't disambiguate embeddings: every `pieces.select(stores(...))`
-- query started failing with PGRST201 ("more than one relationship was
-- found"), which broke Discover, the gallery view, the piece detail
-- page, and the web OG endpoint — basically every app surface that
-- shows a piece alongside its gallery name.
--
-- The cascade-on-delete behavior wasn't worth the breakage: the app's
-- cover lookup already falls back to most-recent when the referenced
-- piece is missing (see galleryCover() in mystores.tsx and the
-- equivalent in og.js), so a stale cover_piece_id pointing at a
-- deleted row produces no broken UI — just a single round of "fall
-- back to newest." We accept that small data-noise tradeoff.
--
-- The column stays. The index stays. Only the constraint is removed.

alter table public.stores
  drop constraint if exists stores_cover_piece_id_fkey;
