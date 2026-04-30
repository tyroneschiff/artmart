-- Gallery subscriptions ("Follow this gallery").
--
-- A subscriber is a logged-in user who wants to be notified when the
-- gallery owner publishes a new piece. Notification delivery (email,
-- push) is layered on top of this table later — this migration just
-- captures intent + preferences.
--
-- Owners cannot subscribe to their own gallery (they're the publisher;
-- duplicate notifications would be noise). Enforced at insert time by
-- the RLS policy below.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  notify_email boolean not null default true,
  notify_push boolean not null default true,
  created_at timestamptz not null default now(),
  unique (subscriber_id, store_id)
);

create index if not exists subscriptions_store_id_idx
  on public.subscriptions (store_id);

create index if not exists subscriptions_subscriber_id_idx
  on public.subscriptions (subscriber_id);

alter table public.subscriptions enable row level security;

-- Subscribers can read their own subscriptions (for "galleries you follow"
-- screen + checking subscribed state on a gallery page).
drop policy if exists "subs_select_own" on public.subscriptions;
create policy "subs_select_own"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = subscriber_id);

-- Gallery owners can read their own gallery's subscribers (for follower
-- count + future notification fan-out via the edge function).
drop policy if exists "subs_select_owner" on public.subscriptions;
create policy "subs_select_owner"
  on public.subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.stores s
      where s.id = subscriptions.store_id
        and s.owner_id = auth.uid()
    )
  );

-- Subscribers can insert their own subscription, but never to their own
-- gallery. The `not exists` clause blocks self-subscription cleanly.
drop policy if exists "subs_insert_own" on public.subscriptions;
create policy "subs_insert_own"
  on public.subscriptions
  for insert
  to authenticated
  with check (
    auth.uid() = subscriber_id
    and not exists (
      select 1 from public.stores s
      where s.id = store_id
        and s.owner_id = auth.uid()
    )
  );

-- Subscribers can update their own preferences (email/push toggles).
drop policy if exists "subs_update_own" on public.subscriptions;
create policy "subs_update_own"
  on public.subscriptions
  for update
  to authenticated
  using (auth.uid() = subscriber_id)
  with check (auth.uid() = subscriber_id);

-- Subscribers can unfollow.
drop policy if exists "subs_delete_own" on public.subscriptions;
create policy "subs_delete_own"
  on public.subscriptions
  for delete
  to authenticated
  using (auth.uid() = subscriber_id);
