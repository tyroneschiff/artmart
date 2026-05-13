-- Don't count a gallery owner's own piece-detail visits toward
-- view_count. Owners open their own pieces frequently (publishing,
-- sharing, re-checking) and that inflated the view_count metric,
-- which dilutes the "Most visited" Discover sort.
--
-- Anonymous visitors still count (auth.uid() returns null). Signed-in
-- visitors who aren't the owner still count. Only the owner is
-- silently skipped.

create or replace function public.increment_piece_views(p_piece_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select s.owner_id
    into v_owner
    from public.pieces p
    join public.stores s on s.id = p.store_id
    where p.id = p_piece_id;

  -- Skip silently when the caller is the gallery owner.
  if v_owner is not null and v_owner = auth.uid() then
    return;
  end if;

  update public.pieces
    set view_count = view_count + 1
    where id = p_piece_id;
end;
$$;
