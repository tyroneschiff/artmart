-- Allow owners to delete their own galleries.
--
-- Pieces inside the gallery cascade automatically: pieces.store_id has
-- ON DELETE CASCADE referencing stores(id), so deleting a store also
-- removes every piece in it.
--
-- Without this DELETE policy RLS silently rejected store deletes (the
-- known Supabase gotcha logged in CLAUDE.md), making galleries appear
-- "undeletable" from the app.

drop policy if exists "Owners can delete stores" on public.stores;

create policy "Owners can delete stores"
  on public.stores
  for delete
  using (auth.uid() = owner_id);
