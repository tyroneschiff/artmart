-- Allow gallery owners to follow their own gallery.
--
-- Original 016_subscriptions.sql blocked self-subscription out of
-- caution about self-notifications — but that concern belongs in the
-- notification fan-out logic, not the subscription model. Letting
-- owners "follow" their own gallery means their own pieces appear in
-- their personal Following feed alongside galleries they follow from
-- other parents — which is what an owner expects.
--
-- The notification edge function (when shipped) will exclude the
-- owner from the recipient list of pieces they themselves publish,
-- preventing the obvious "you got a new piece from yourself" loop.

drop policy if exists "subs_insert_own" on public.subscriptions;

create policy "subs_insert_own"
  on public.subscriptions
  for insert
  to authenticated
  with check (auth.uid() = subscriber_id);

-- Backfill: subscribe every existing gallery owner to their own gallery
-- so the Following feed isn't empty for users who already have galleries
-- when this migration ships.
insert into public.subscriptions (subscriber_id, store_id)
select owner_id, id from public.stores
on conflict (subscriber_id, store_id) do nothing;
