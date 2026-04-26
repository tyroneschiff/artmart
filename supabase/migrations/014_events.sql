-- Lightweight event log for measuring the kill criteria from CLAUDE.md:
-- shares-per-completed-transform, signups-per-share, plus standard funnel.
-- Anonymous OG views are allowed (no auth required) so we can attribute share
-- reach back to a piece. Reads restricted to service role only (no PII leak).

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  piece_id uuid references public.pieces(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_event_type_created_at_idx
  on public.events (event_type, created_at desc);

create index if not exists events_user_id_created_at_idx
  on public.events (user_id, created_at desc);

create index if not exists events_piece_id_idx
  on public.events (piece_id) where piece_id is not null;

alter table public.events enable row level security;

-- Anyone (including anonymous) can insert. We want OG views, signups, etc.
create policy "events_insert_any"
  on public.events for insert
  to anon, authenticated
  with check (true);

-- No client-side reads. Use service role / dashboard only.
-- (No SELECT policy = no one but service_role can read.)
