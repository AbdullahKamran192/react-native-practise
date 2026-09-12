-- Pantry-only operation. No consumption/history tables are created.
begin;
create or replace function public.consume_meal_from_pantry(p_meal_id bigint)
returns table (
  pantry_items_deducted integer,
  pantry_items_exhausted integer,
  pantry_items_short integer
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_item record;
  v_pantry_id bigint;
  v_remaining numeric;
  v_count integer := 0;
begin
  if v_user is null then
    raise exception 'Sign in to consume a meal.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('consume-user:' || v_user::text, 0));
  perform 1 from public.meals where id = p_meal_id and user_id = v_user for share;
  if not found then
    raise exception 'This meal is no longer available.' using errcode = '42501';
  end if;
  pantry_items_deducted := 0;
  pantry_items_exhausted := 0;
  pantry_items_short := 0;
  for v_item in
    select amount, product_barcode, generic_product_id
    from public.meal_items where meal_id = p_meal_id order by id
  loop
    v_count := v_count + 1;
    select id, amount_remaining into v_pantry_id, v_remaining
    from public.pantry where user_id = v_user and (
      (v_item.product_barcode is not null and product_barcode = v_item.product_barcode)
      or (v_item.generic_product_id is not null and generic_product_id = v_item.generic_product_id)
    ) for update;
    if not found then
      pantry_items_short := pantry_items_short + 1;
      continue;
    end if;
    pantry_items_deducted := pantry_items_deducted + 1;
    if v_remaining < v_item.amount then
      pantry_items_short := pantry_items_short + 1;
    end if;
    if v_remaining <= v_item.amount then
      delete from public.pantry where id = v_pantry_id and user_id = v_user;
      pantry_items_exhausted := pantry_items_exhausted + 1;
    else
      update public.pantry set amount_remaining = v_remaining - v_item.amount
        where id = v_pantry_id and user_id = v_user;
    end if;
  end loop;
  if v_count = 0 then
    raise exception 'Add at least one ingredient before consuming this meal.' using errcode = '22023';
  end if;
  return next;
end;
$$;
revoke all on function public.consume_meal_from_pantry(bigint) from public, anon, authenticated;
grant execute on function public.consume_meal_from_pantry(bigint) to authenticated;
commit;
