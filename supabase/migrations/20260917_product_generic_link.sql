-- Run once in FoodWorth's Supabase SQL Editor. Classification is admin-managed.
begin;
alter table public.products
  add column generic_product_id bigint references public.generic_products(id) on delete set null;
create index products_generic_product_id_idx on public.products(generic_product_id);
commit;
