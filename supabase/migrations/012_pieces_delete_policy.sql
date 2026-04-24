create policy "Store owners can delete pieces" on public.pieces
  for delete using (store_id in (select id from public.stores where owner_id = auth.uid()));
