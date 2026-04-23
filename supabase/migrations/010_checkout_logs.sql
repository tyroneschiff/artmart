-- Checkout failure logs for reliability tracking
create table public.checkout_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  piece_id uuid references public.pieces on delete set null,
  error_code text,
  error_message text,
  payment_intent_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.checkout_logs enable row level security;

-- Only admins/service role can view logs
create policy "Service role can manage checkout logs" on public.checkout_logs using (true);
