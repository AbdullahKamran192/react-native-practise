-- Run after the existing food consumption and logging migrations.
-- Older logs have no reliable eating time: initially classify them as Snack.
begin;
alter table public.food_consumption
  add column meal_period text not null default 'Snack'
  constraint food_consumption_meal_period_check
    check (meal_period in ('Breakfast', 'Lunch', 'Dinner', 'Snack'));

-- Replace the previous signature, avoiding ambiguous PostgREST overloads.
-- The new final parameter is optional so older clients can still log.
drop function public.log_food_consumption(uuid, date, text, boolean, bigint, text, bigint, numeric, text, text);
create or replace function public.log_food_consumption(
  p_group_id uuid,
  p_consumed_on date,
  p_time_zone text,
  p_remove_from_pantry boolean,
  p_meal_id bigint default null,
  p_product_barcode text default null,
  p_generic_product_id bigint default null,
  p_amount numeric default null,
  p_measurement_unit text default null,
  p_brand text default null,
  p_meal_period text default null
)
returns setof public.food_consumption
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_meal_name text;
  v_item record;
  v_pantry_id bigint;
  v_remaining numeric;
  v_count integer := 0;
  v_period text;
  v_hour integer;
begin
  if v_user is null then
    raise exception 'Sign in to log food.' using errcode = '42501';
  end if;
  if p_group_id is null then
    raise exception 'A consumption group ID is required.' using errcode = '22023';
  end if;
  -- Serialize this user's logs and the existing pantry-only meal operation.
  perform pg_advisory_xact_lock(hashtextextended('consume-user:' || v_user::text, 0));
  -- The group is the retry token. Return the original snapshots before looking
  -- up a potentially edited/deleted recipe. Never repeat pantry deductions.
  if exists (select 1 from public.food_consumption
    where user_id = v_user and consumption_group_id = p_group_id) then
    return query select * from public.food_consumption
      where user_id = v_user and consumption_group_id = p_group_id order by id;
    return;
  end if;
  if p_time_zone is null or not exists (
    select 1 from pg_timezone_names where name = p_time_zone
  ) then
    raise exception 'Choose a valid time zone.' using errcode = '22023';
  end if;
  v_hour := extract(hour from current_timestamp at time zone p_time_zone);
  v_period := coalesce(p_meal_period, case
    when v_hour between 5 and 10 then 'Breakfast'
    when v_hour between 11 and 14 then 'Lunch'
    when v_hour between 17 and 21 then 'Dinner'
    else 'Snack' end);
  if v_period not in ('Breakfast', 'Lunch', 'Dinner', 'Snack') then
    raise exception 'Choose Breakfast, Lunch, Dinner or Snack.' using errcode = '22023';
  end if;
  if p_consumed_on is null or not isfinite(p_consumed_on)
    or p_consumed_on > (current_timestamp at time zone p_time_zone)::date then
    raise exception 'Choose today or an earlier date.' using errcode = '22023';
  end if;
  if p_remove_from_pantry is null then
    raise exception 'Choose whether to remove pantry stock.' using errcode = '22023';
  end if;

  if p_meal_id is not null then
    if p_product_barcode is not null or p_generic_product_id is not null or p_amount is not null then
      raise exception 'Choose a meal or a single product.' using errcode = '22023';
    end if;
    select meal_name into v_meal_name from public.meals
      where id = p_meal_id and user_id = v_user for share;
    if not found then
      raise exception 'This meal is no longer available.' using errcode = '42501';
    end if;
  else
    if (p_product_barcode is null) = (p_generic_product_id is null) then
      raise exception 'Choose exactly one product.' using errcode = '22023';
    end if;
    if p_amount is null or not (p_amount > 0 and p_amount < 1000000000)
      or round(p_amount, 3) <= 0 or round(p_amount, 3) >= 1000000000 then
      raise exception 'Enter a positive amount with at most three decimal places, below 1000000000.' using errcode = '22023';
    end if;
    if p_measurement_unit is null or p_measurement_unit not in ('g', 'ml') then
      raise exception 'Choose grams or millilitres.' using errcode = '22023';
    end if;
  end if;

  -- One snapshot of the ingredient list and nutrition for this eating event.
  for v_item in
    with ingredients as (
      select mi.id, mi.product_barcode, mi.generic_product_id, mi.amount
      from public.meal_items mi where p_meal_id is not null and mi.meal_id = p_meal_id
      union all
      select 0::bigint, p_product_barcode, p_generic_product_id, round(p_amount, 3)
      where p_meal_id is null
    )
    select i.*,
      coalesce(c.product_name, p.product_name, g.product_name) as product_name,
      coalesce(p.measurement_unit, g.measurement_unit) as unit,
      c.measurement_unit as correction_unit,
      coalesce(c.calories_per_100, p.calories_per_100, g.calories_per_100) as calories,
      coalesce(c.protein_per_100, p.protein_per_100, g.protein_per_100) as protein,
      coalesce(c.carbs_per_100, p.carbs_per_100, g.carbs_per_100) as carbs,
      coalesce(c.fat_per_100, p.fat_per_100, g.fat_per_100) as fat,
      coalesce(c.sugars_per_100, p.sugars_per_100, g.sugars_per_100) as sugars,
      coalesce(c.salt_per_100, p.salt_per_100, g.salt_per_100) as salt,
      coalesce(c.fibre_per_100, p.fibre_per_100, g.fibre_per_100) as fibre
    from ingredients i
    left join public.products p on p.barcode_number = i.product_barcode
    left join public.generic_products g on g.id = i.generic_product_id
    -- Match single-food lookup: personal corrections override shared values.
    -- Meals use the shared catalogue, matching the meal details screen.
    left join public.product_corrections c on p_meal_id is null
      and c.product_barcode = i.product_barcode and c.user_id = v_user
    order by i.id
  loop
    v_count := v_count + 1;
    if v_item.product_name is null or btrim(v_item.product_name) = '' or v_item.unit is null then
      raise exception 'Product details are missing. Save a product name and unit before logging.' using errcode = '22023';
    end if;
    if p_meal_id is null and (p_measurement_unit <> v_item.unit
      or (v_item.correction_unit is not null and v_item.correction_unit <> v_item.unit)) then
      raise exception 'The product unit changed. Reload it before logging.' using errcode = '22023';
    end if;
    insert into public.food_consumption (
      user_id, consumed_on, consumption_group_id, meal_id, meal_name_snapshot, meal_period,
      product_barcode, generic_product_id, product_name_snapshot, brand_snapshot,
      amount_consumed, measurement_unit, calories_consumed, protein_consumed, carbs_consumed, fat_consumed, sugars_consumed, salt_consumed, fibre_consumed
    ) values (
      v_user, p_consumed_on, p_group_id, p_meal_id, v_meal_name, v_period,
      v_item.product_barcode, v_item.generic_product_id, v_item.product_name,
      case when p_meal_id is null and v_item.product_barcode is not null then nullif(btrim(p_brand), '') else null end,
      v_item.amount, v_item.unit, v_item.calories * v_item.amount / 100, v_item.protein * v_item.amount / 100, v_item.carbs * v_item.amount / 100, v_item.fat * v_item.amount / 100, v_item.sugars * v_item.amount / 100, v_item.salt * v_item.amount / 100, v_item.fibre * v_item.amount / 100
    );
    if p_remove_from_pantry then
      select id, amount_remaining into v_pantry_id, v_remaining
      from public.pantry where user_id = v_user and (
        (v_item.product_barcode is not null and product_barcode = v_item.product_barcode)
        or (v_item.generic_product_id is not null and generic_product_id = v_item.generic_product_id)
      ) for update;
      if found then
        if v_remaining <= v_item.amount then
          delete from public.pantry where id = v_pantry_id and user_id = v_user;
        else
          update public.pantry set amount_remaining = v_remaining - v_item.amount
            where id = v_pantry_id and user_id = v_user;
        end if;
      end if;
    end if;
  end loop;
  if v_count = 0 then
    raise exception 'Add at least one ingredient before logging a meal.' using errcode = '22023';
  end if;
  return query select * from public.food_consumption
    where user_id = v_user and consumption_group_id = p_group_id order by id;
end;
$$;
revoke all on function public.log_food_consumption(uuid, date, text, boolean, bigint, text, bigint, numeric, text, text, text)
  from public, anon, authenticated;
grant execute on function public.log_food_consumption(uuid, date, text, boolean, bigint, text, bigint, numeric, text, text, text)
  to authenticated;
comment on column public.food_consumption.consumption_group_id is
  'One eating event; log_food_consumption serializes requests per user and reuses saved groups on retry.';



-- Update the whole eating event atomically, without touching stock or nutrition.
create or replace function public.set_consumption_meal_period(p_group_id uuid, p_meal_period text)
returns integer language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'Sign in to update this food log.' using errcode = '42501';
  end if;
  if p_group_id is null or p_meal_period is null
    or p_meal_period not in ('Breakfast', 'Lunch', 'Dinner', 'Snack') then
    raise exception 'Choose a food log and a valid meal period.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('consume-user:' || v_user::text, 0));
  update public.food_consumption set meal_period = p_meal_period
    where user_id = v_user and consumption_group_id = p_group_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'This food log is no longer available.' using errcode = '22023';
  end if;
  return v_count;
end;
$$;
revoke all on function public.set_consumption_meal_period(uuid, text) from public, anon, authenticated;
grant execute on function public.set_consumption_meal_period(uuid, text) to authenticated;
commit;
