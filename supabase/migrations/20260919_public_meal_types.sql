-- Run AFTER 20260919_public_meals.sql. Ingredient amounts and existing logs stay unchanged.
begin;
drop function public.save_public_meal(bigint,integer,jsonb);
drop function public.log_public_meal(bigint,integer,jsonb,uuid,date,text,boolean,text);
drop function public.public_meal_selection(bigint,integer,jsonb);
alter table public.public_meals drop column servings;
alter table public.public_meals add column meal_type text not null default 'Other'
  check (meal_type in ('Quick meals','30-minute meals','High-protein meals','Budget meals',
    'Slow-cooker meals','Breakfast','Lunch','Dinner','Snacks','Desserts','Other'));
create index public_meals_type_id_idx on public.public_meals(meal_type,id);

-- Only categories with recipes need rows on Explore Meals.
create function public.public_meal_types() returns table(meal_type text)
language sql stable security invoker set search_path=pg_catalog as $$
  select distinct m.meal_type from public.public_meals m order by m.meal_type;
$$;
revoke all on function public.public_meal_types() from public,anon,authenticated;
grant execute on function public.public_meal_types() to authenticated;

create function public.public_meal_selection(p_meal_id bigint, p_items jsonb)
returns table(product_barcode text, generic_product_id bigint, amount numeric, measurement_unit text)
language plpgsql set search_path = pg_catalog as $$
begin
  perform 1 from public.public_meals where id = p_meal_id for share;
  if not found then raise exception 'This public meal is no longer available.' using errcode='22023'; end if;
  if p_items is null
    or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Choose ingredients.' using errcode='22023'; end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Choose between 1 and 50 ingredient selections.' using errcode='22023'; end if;
  perform 1 from public.public_meal_ingredients where public_meal_id=p_meal_id for share;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as s(ingredient_id bigint, product_barcode text, generic_product_id bigint, amount numeric)
    left join public.public_meal_ingredients i on i.id=s.ingredient_id and i.public_meal_id=p_meal_id
    left join public.products p on p.barcode_number=s.product_barcode
    left join public.generic_products g on g.id=s.generic_product_id
    where i.id is null or (s.product_barcode is null) = (s.generic_product_id is null)
      or coalesce(p.measurement_unit,g.measurement_unit) is distinct from i.measurement_unit
      or s.amount is null or not(s.amount > 0 and s.amount <= 100000) or round(s.amount,3) <> s.amount
  ) then raise exception 'An ingredient is missing or its amount or unit is invalid. Reload the recipe.' using errcode='22023'; end if;
  if exists (
    select 1 from public.public_meal_ingredients i
    left join (select ingredient_id,sum(s.amount) total from jsonb_to_recordset(p_items)
      as s(ingredient_id bigint, amount numeric) group by ingredient_id) s on s.ingredient_id=i.id
    where i.public_meal_id=p_meal_id and
      ((not i.is_optional and s.total is null) or
       (s.total is not null and s.total <> i.amount))
  ) then raise exception 'Ingredient amounts no longer match this recipe. Reload it.' using errcode='22023'; end if;
  return query select s.product_barcode,s.generic_product_id,sum(s.amount),i.measurement_unit
    from jsonb_to_recordset(p_items) as s(ingredient_id bigint,product_barcode text,generic_product_id bigint,amount numeric)
    join public.public_meal_ingredients i on i.id=s.ingredient_id
    group by s.product_barcode,s.generic_product_id,i.measurement_unit;
end;
$$;
revoke all on function public.public_meal_selection(bigint,jsonb) from public,anon,authenticated;

create function public.save_public_meal(p_meal_id bigint,p_items jsonb)
returns bigint language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid := auth.uid(); v_id bigint; v_recipe public.public_meals; v_item record;
begin
  if v_user is null then raise exception 'Sign in to save meals.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('consume-user:'||v_user::text,0));
  if (select count(*) from public.meals where user_id=v_user)>=10 then
    raise exception 'You already have 10 meals. Remove one before saving another.' using errcode='22023'; end if;
  select * into v_recipe from public.public_meals where id=p_meal_id for share;
  if not found then raise exception 'Public meal not found.' using errcode='22023'; end if;
  insert into public.meals(user_id,meal_name,description,instructions,public_image_path)
    values(v_user,v_recipe.meal_name,v_recipe.description,v_recipe.instructions,v_recipe.image_path) returning id into v_id;
  for v_item in select * from public.public_meal_selection(p_meal_id,p_items) loop
    insert into public.meal_items(meal_id,product_barcode,generic_product_id,amount)
      values(v_id,v_item.product_barcode,v_item.generic_product_id,v_item.amount);
  end loop;
  return v_id;
end;
$$;
revoke all on function public.save_public_meal(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.save_public_meal(bigint,jsonb) to authenticated;

create function public.log_public_meal(p_meal_id bigint,p_items jsonb,
  p_group_id uuid,p_consumed_on date,p_time_zone text,p_remove_from_pantry boolean,p_meal_period text)
returns setof public.food_consumption language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid:=auth.uid(); v_name text; v_item record; v_child uuid;
begin
  if v_user is null then raise exception 'Sign in to log meals.' using errcode='42501'; end if;
  if p_group_id is null then raise exception 'A logging ID is required.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('consume-user:'||v_user::text,0));
  if exists(select 1 from public.food_consumption where user_id=v_user and consumption_group_id=p_group_id) then
    return query select * from public.food_consumption where user_id=v_user and consumption_group_id=p_group_id order by id;
    return;
  end if;
  select meal_name into v_name from public.public_meals where id=p_meal_id for share;
  for v_item in select * from public.public_meal_selection(p_meal_id,p_items) loop
    v_child:=gen_random_uuid();
    -- Reuse the existing validated snapshot + pantry deduction operation.
    -- Everything runs in this one transaction, including all child calls.
    perform public.log_food_consumption(v_child,p_consumed_on,p_time_zone,p_remove_from_pantry,
      null,v_item.product_barcode,v_item.generic_product_id,v_item.amount,v_item.measurement_unit,null,p_meal_period);
    update public.food_consumption set consumption_group_id=p_group_id,meal_name_snapshot=v_name
      where user_id=v_user and consumption_group_id=v_child;
  end loop;
  return query select * from public.food_consumption where user_id=v_user and consumption_group_id=p_group_id order by id;
end;
$$;
revoke all on function public.log_public_meal(bigint,jsonb,uuid,date,text,boolean,text) from public,anon,authenticated;
grant execute on function public.log_public_meal(bigint,jsonb,uuid,date,text,boolean,text) to authenticated;
commit;
