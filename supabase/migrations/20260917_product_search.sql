-- Run in Supabase SQL Editor before using the updated search screen.
-- Adds indexes and a read-only function; no product rows are changed.
begin;
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
set local search_path = public, extensions, pg_catalog;
create index if not exists products_name_trgm_idx
  on public.products using gin (product_name gin_trgm_ops);
create index if not exists generic_products_name_trgm_idx
  on public.generic_products using gin (product_name gin_trgm_ops);

create or replace function public.search_food_products(p_search text, p_page integer default 0)
returns table (
  id text, source text, product_name text, image_path text, image_url text,
  product_amount numeric, measurement_unit text
)
language plpgsql stable security invoker set search_path = pg_catalog
as $$
begin
  if p_page is null or p_page < 0 then
    raise exception 'Invalid search page.' using errcode = '22023';
  end if;
  if p_search is null or btrim(p_search) = '' then return; end if;
  return query
    select r.product_id, r.product_source, r.name, r.path, r.url, r.amount, r.unit
    from (
      select p.barcode_number::text as product_id, 'barcode'::text as product_source,
        p.product_name::text as name, p.image_path::text as path, p.image_url::text as url,
        p.product_amount::numeric as amount, p.measurement_unit::text as unit,
        0 as catalogue, p.barcode_number::text as barcode_order, null::bigint as generic_order
      from public.products p
      where p.product_name ilike '%' || btrim(p_search) || '%'
      union all
      select g.id::text, 'generic'::text, g.product_name::text, g.image_path::text, null::text,
        g.default_amount::numeric, g.measurement_unit::text, 1, null::text, g.id
      from public.generic_products g
      where g.product_name ilike '%' || btrim(p_search) || '%'
    ) r
    order by r.catalogue, r.name, r.barcode_order, r.generic_order
    limit 51 offset (p_page::bigint * 50);
end;
$$;
revoke all on function public.search_food_products(text, integer) from public, anon;
grant execute on function public.search_food_products(text, integer) to authenticated;
commit;
