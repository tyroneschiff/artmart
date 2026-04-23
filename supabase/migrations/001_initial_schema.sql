-- Users extended profile (Supabase Auth handles the base user)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Stores (one per child)
create table public.stores (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users on delete cascade not null,
  child_name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz default now()
);
alter table public.stores enable row level security;
create policy "Stores are viewable by everyone" on public.stores for select using (true);
create policy "Owners can insert stores" on public.stores for insert with check (auth.uid() = owner_id);
create policy "Owners can update stores" on public.stores for update using (auth.uid() = owner_id);

-- Pieces (artwork items)
create table public.pieces (
  id uuid default gen_random_uuid() primary key,
  store_id uuid references public.stores on delete cascade not null,
  title text not null,
  original_image_url text not null,
  transformed_image_url text,
  ai_description text,
  ai_prompt text,
  vote_count integer default 0 not null,
  price_digital integer default 299 not null, -- cents
  price_print integer default 2999 not null,  -- cents
  published boolean default false not null,
  created_at timestamptz default now()
);
alter table public.pieces enable row level security;
create policy "Published pieces are viewable by everyone" on public.pieces for select using (published = true or store_id in (select id from public.stores where owner_id = auth.uid()));
create policy "Store owners can insert pieces" on public.pieces for insert with check (store_id in (select id from public.stores where owner_id = auth.uid()));
create policy "Store owners can update pieces" on public.pieces for update using (store_id in (select id from public.stores where owner_id = auth.uid()));

-- Votes (one per user per piece)
create table public.votes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  piece_id uuid references public.pieces on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, piece_id)
);
alter table public.votes enable row level security;
create policy "Users can view all votes" on public.votes for select using (true);
create policy "Users can insert own votes" on public.votes for insert with check (auth.uid() = user_id);
create policy "Users can delete own votes" on public.votes for delete using (auth.uid() = user_id);

-- Function to increment/decrement vote count atomically
create or replace function public.handle_vote_insert()
returns trigger language plpgsql security definer as $$
begin
  update public.pieces set vote_count = vote_count + 1 where id = new.piece_id;
  return new;
end;
$$;

create or replace function public.handle_vote_delete()
returns trigger language plpgsql security definer as $$
begin
  update public.pieces set vote_count = vote_count - 1 where id = old.piece_id;
  return old;
end;
$$;

create trigger on_vote_insert after insert on public.votes for each row execute function public.handle_vote_insert();
create trigger on_vote_delete after delete on public.votes for each row execute function public.handle_vote_delete();

-- Orders
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  buyer_id uuid references auth.users on delete set null,
  piece_id uuid references public.pieces on delete set null not null,
  order_type text not null check (order_type in ('digital', 'print')),
  stripe_payment_intent text,
  printful_order_id text,
  status text default 'pending' not null,
  buyer_email text,
  created_at timestamptz default now()
);
alter table public.orders enable row level security;
create policy "Buyers can view own orders" on public.orders for select using (auth.uid() = buyer_id);
create policy "Service role can manage orders" on public.orders using (true);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Storage buckets
insert into storage.buckets (id, name, public) values ('artwork', 'artwork', true) on conflict do nothing;
create policy "Anyone can view artwork" on storage.objects for select using (bucket_id = 'artwork');
create policy "Authenticated users can upload artwork" on storage.objects for insert with check (bucket_id = 'artwork' and auth.role() = 'authenticated');
