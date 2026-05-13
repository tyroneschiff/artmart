-- Let gallery owners pick which piece serves as the gallery cover.
-- Without this, the cover is always "most recent published piece" —
-- which means the kid's best work gets buried by their newest. Most
-- parents have a clear sense of which world is "the one" they want
-- on the OG card preview, the my-galleries list, and the web
-- gallery header.
--
-- Nullable on purpose: NULL means "auto = most recent", so existing
-- galleries continue working without a forced default. Once an owner
-- picks one, it sticks.
--
-- ON DELETE SET NULL so deleting a piece doesn't break the parent
-- gallery — it just falls back to auto-pick again.

alter table public.stores
  add column if not exists cover_piece_id uuid references public.pieces(id) on delete set null;

create index if not exists stores_cover_piece_idx
  on public.stores (cover_piece_id) where cover_piece_id is not null;
