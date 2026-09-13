-- Run in FoodWorth's Supabase SQL Editor before using the updated app.
begin;

alter table public.products add column if not exists image_url text;
alter table public.generic_products add column if not exists image_url text;
alter table public.product_corrections add column if not exists image_url text;

-- The existing correction trigger creates/updates the shared product.
-- Fill its missing image from a saved correction without replacing its
-- existing image or changing the existing nutrition aggregation function.
create or replace function public.fill_product_image_from_corrections()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.image_url is null then
    select c.image_url into new.image_url
    from public.product_corrections c
    where c.product_barcode = new.barcode_number
      and nullif(btrim(c.image_url), '') is not null
    order by c.user_id
    limit 1;
  end if;
  return new;
end;
$$;

revoke all on function public.fill_product_image_from_corrections() from public, anon, authenticated;
drop trigger if exists fill_product_image on public.products;
create trigger fill_product_image
before insert or update on public.products
for each row execute function public.fill_product_image_from_corrections();

comment on column public.products.image_url is 'Optional external product image URL; currently sourced from Open Food Facts.';
comment on column public.generic_products.image_url is 'Optional product image URL. NULL displays the default placeholder.';
comment on column public.product_corrections.image_url is 'Optional product image URL saved with this correction.';

commit;
