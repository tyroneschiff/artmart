-- Public follower count without leaking subscriber identities.
--
-- The base subscriptions table SELECT policy (016) restricts row reads
-- to (a) the subscriber themselves and (b) the gallery owner. That's
-- correct for privacy — we don't want to expose who follows whom — but
-- it broke the public follower count rendered on the gallery page for
-- non-owner visitors, who saw "0 following" even when followers exist.
--
-- This SECURITY DEFINER function returns just the count, not the rows,
-- so the count is a public social signal while subscriber identities
-- stay behind RLS. Granted to anon + authenticated.

create or replace function public.subscriber_count(p_store_id uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int from public.subscriptions where store_id = p_store_id;
$$;

revoke all on function public.subscriber_count(uuid) from public;
grant execute on function public.subscriber_count(uuid) to anon, authenticated;
