-- Add quantity to orders
alter table public.orders 
add column quantity integer not null default 1;
