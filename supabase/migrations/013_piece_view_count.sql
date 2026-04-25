alter table public.pieces add column if not exists view_count integer not null default 0;

create or replace function public.increment_piece_views(p_piece_id uuid)
returns void
language sql
security definer
as $$
  update public.pieces set view_count = view_count + 1 where id = p_piece_id;
$$;
