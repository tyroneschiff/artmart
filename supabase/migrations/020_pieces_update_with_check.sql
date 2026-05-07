-- Tighten the pieces UPDATE policy with a `with check` clause.
--
-- The original policy in 001_initial_schema.sql only had a `using`
-- predicate, which validates the row BEFORE the update. That allowed
-- a user to move a piece OUT of a gallery they own, but the new
-- store_id (the destination) was not validated — a crafted PATCH
-- could in theory point store_id at a gallery owned by someone else.
--
-- Adding `with check` ensures the row AFTER the update also passes
-- the ownership predicate, so the destination gallery must also be
-- owned by the same user.

drop policy if exists "Store owners can update pieces" on public.pieces;

create policy "Store owners can update pieces"
  on public.pieces
  for update
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  )
  with check (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  );
