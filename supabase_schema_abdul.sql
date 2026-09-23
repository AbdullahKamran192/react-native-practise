


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."begin_product_image_action"("p_actor" "uuid", "p_user" "uuid", "p_barcode" "text", "p_action" "text", "p_submitted" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
declare c public.product_corrections; ticket timestamptz := clock_timestamp();
begin
 if p_action not in ('upload','approve','reject') then raise exception 'Invalid action'; end if;
 if p_action='upload' then
  if p_actor<>p_user then raise exception 'Not authorised'; end if;
  if exists(select 1 from public.user_image_moderation where user_id=p_user and (image_upload_blocked or violation_count>=3)) then
   raise exception 'Product photo uploads are blocked for this account.';
  end if;
 else
  if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Not authorised'; end if;
 end if;
 perform 1 from public.products where barcode_number=p_barcode for update;
 if not found then raise exception 'Save the product information first.'; end if;
 if exists(select 1 from public.product_corrections where product_barcode=p_barcode
   and image_reviewed_by is not null and (image_status='pending' or image_submitted_at is null)) then
  raise exception 'A photo operation is already in progress. Try again shortly.';
 end if;
 select * into c from public.product_corrections where user_id=p_user and product_barcode=p_barcode for update;
 if not found then raise exception 'Save the product correction first.'; end if;
 if p_action='upload' then
  if c.image_status='pending' then raise exception 'Your photo is already awaiting review.'; end if;
  -- Existing shared/OFF images may be replaced after administrator review.
 else
  if c.image_status is distinct from 'pending' or c.image_path is null or c.image_submitted_at is distinct from p_submitted then
   raise exception 'This submission has changed or was already reviewed.';
  end if;
 end if;
 update public.product_corrections set image_reviewed_by=p_actor,image_reviewed_at=ticket,
   image_status=case when p_action='upload' then 'pending' else image_status end
 where user_id=p_user and product_barcode=p_barcode;
 return jsonb_build_object('ticket',ticket,'previous',to_jsonb(c));
end; $$;


ALTER FUNCTION "public"."begin_product_image_action"("p_actor" "uuid", "p_user" "uuid", "p_barcode" "text", "p_action" "text", "p_submitted" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_shopping"("p_trip_id" "uuid", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
declare
  v_user uuid := auth.uid();
  i record; p record; settings record;
  v_cal numeric; v_pro numeric; v_score numeric; v_total numeric := 0;
  v_count integer;
begin
  if v_user is null then raise exception 'Sign in to complete shopping.' using errcode='42501'; end if;
  if p_trip_id is null then raise exception 'Missing shopping trip identifier.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('consume-user:' || v_user::text, 0));
  -- A retry after a lost response returns the original trip without touching stock.
  if exists (select 1 from public.shopping_trips where id=p_trip_id and user_id=v_user) then return p_trip_id; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Provide shopping items.'; end if;
  if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Add between 1 and 100 items.'; end if;
  select * into settings from public.user_settings where user_id=v_user;
  insert into public.shopping_trips(id,user_id,total_spent) values(p_trip_id,v_user,0);
  for i in select * from jsonb_to_recordset(p_items) as x(product_barcode text, generic_product_id bigint,
    amount numeric, price numeric, measurement_unit text, brand text)
  loop
    if (i.product_barcode is null) = (i.generic_product_id is null)
      or i.amount is null or not (i.amount > 0 and i.amount <= 100000000) or i.amount <> round(i.amount,3)
      or i.price is null or not (i.price >= 0 and i.price <= 1000000) or i.price <> round(i.price,2) then
      raise exception 'Check the product, amount and price of every cart item.';
    end if;
    select coalesce(c.product_name,b.product_name,g.product_name) as name,
      coalesce(b.measurement_unit,g.measurement_unit) as unit, c.measurement_unit as correction_unit,
      coalesce(c.calories_per_100,b.calories_per_100,g.calories_per_100) as calories,
      coalesce(c.protein_per_100,b.protein_per_100,g.protein_per_100) as protein
    into p from (select 1) seed
    left join public.products b on b.barcode_number=i.product_barcode
    left join public.generic_products g on g.id=i.generic_product_id
    left join public.product_corrections c on c.product_barcode=b.barcode_number and c.user_id=v_user;
    if p.name is null or btrim(p.name)='' or p.unit is null then raise exception 'A cart product is no longer available.'; end if;
    if i.measurement_unit is distinct from p.unit or (p.correction_unit is not null and p.correction_unit<>p.unit) then
      raise exception 'A product measurement unit changed. Review this cart item.';
    end if;
    v_cal := null; v_pro := null; v_score := null;
    if i.price>0 and settings.cost_target_per_day>0 then
      if p.calories>=0 and p.calories<'Infinity'::numeric and settings.calories_target_per_day>0 then
        v_cal:=p.calories*i.amount/i.price*settings.cost_target_per_day/settings.calories_target_per_day;
      end if;
      if p.protein>=0 and p.protein<'Infinity'::numeric and settings.protein_target_per_day>0 then
        v_pro:=p.protein*i.amount/i.price*settings.cost_target_per_day/settings.protein_target_per_day;
      end if;
      if v_cal is not null and v_pro is not null then v_score:=(least(v_cal,100)+least(v_pro,100))/2; end if;
    end if;
    insert into public.shopping_trip_items(shopping_trip_id,product_barcode,generic_product_id,
      product_name_snapshot,brand_snapshot,amount_purchased,measurement_unit,price_paid,calorie_percentage,protein_percentage,overall_grade)
    values(p_trip_id,i.product_barcode,i.generic_product_id,p.name,nullif(left(btrim(i.brand),300),''),i.amount,p.unit,i.price,v_cal,v_pro,
      case when v_score is null then null when v_score>=90 then 'A' when v_score>=70 then 'B'
        when v_score>=50 then 'C' when v_score>=30 then 'D' else 'E' end);
    update public.pantry set amount_remaining=amount_remaining+i.amount
      where user_id=v_user and ((i.product_barcode is not null and product_barcode=i.product_barcode)
        or (i.generic_product_id is not null and generic_product_id=i.generic_product_id));
    if not found then
      insert into public.pantry(user_id,product_barcode,generic_product_id,amount_remaining)
        values(v_user,i.product_barcode,i.generic_product_id,i.amount) on conflict do nothing;
      get diagnostics v_count=row_count;
      if v_count=0 then
        update public.pantry set amount_remaining=amount_remaining+i.amount
          where user_id=v_user and ((i.product_barcode is not null and product_barcode=i.product_barcode)
            or (i.generic_product_id is not null and generic_product_id=i.generic_product_id));
        if not found then raise exception 'Pantry changed. Please retry checkout.'; end if;
      end if;
    end if;
    v_total:=v_total+i.price;
  end loop;
  update public.shopping_trips set total_spent=v_total where id=p_trip_id;
  return p_trip_id;
end;
$$;


ALTER FUNCTION "public"."complete_shopping"("p_trip_id" "uuid", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_meal_from_pantry"("p_meal_id" bigint) RETURNS TABLE("pantry_items_deducted" integer, "pantry_items_exhausted" integer, "pantry_items_short" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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


ALTER FUNCTION "public"."consume_meal_from_pantry"("p_meal_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_food_consumption"("p_group_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'Sign in to delete a food log.' using errcode = '42501';
  end if;
  if p_group_id is null then
    raise exception 'Choose a food log.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('consume-user:' || v_user::text, 0));
  delete from public.food_consumption
    where user_id = v_user and consumption_group_id = p_group_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."delete_food_consumption"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_shopping_trip"("p_trip_id" "uuid", "p_remove_from_pantry" boolean DEFAULT false) RETURNS TABLE("trip_deleted" boolean, "pantry_items_updated" integer, "pantry_items_unavailable" integer, "pantry_items_short" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
declare
  v_user uuid := auth.uid();
  v_item record;
  v_stock record;
begin
  if v_user is null then raise exception 'Sign in to delete a purchase.' using errcode='42501'; end if;
  if p_trip_id is null then raise exception 'Choose a shopping trip.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('consume-user:' || v_user::text, 0));
  trip_deleted := false;
  pantry_items_updated := 0;
  pantry_items_unavailable := 0;
  pantry_items_short := 0;
  perform 1 from public.shopping_trips where id=p_trip_id and user_id=v_user for update;
  -- A retry must never deduct stock a second time.
  if not found then return next; return; end if;
  if p_remove_from_pantry then
    -- Combine repeat purchases of the same product before deducting stock.
    for v_item in
      select product_barcode, generic_product_id, measurement_unit, sum(amount_purchased) as amount
      from public.shopping_trip_items where shopping_trip_id=p_trip_id
      group by product_barcode, generic_product_id, measurement_unit
      order by product_barcode nulls last, generic_product_id, measurement_unit
    loop
      select stock.id, stock.amount_remaining into v_stock
      from public.pantry stock
      left join public.products p on p.barcode_number=stock.product_barcode
      left join public.generic_products g on g.id=stock.generic_product_id
      where stock.user_id=v_user
        and ((v_item.product_barcode is not null and stock.product_barcode=v_item.product_barcode)
          or (v_item.generic_product_id is not null and stock.generic_product_id=v_item.generic_product_id))
        and coalesce(p.measurement_unit,g.measurement_unit)=v_item.measurement_unit
      for update of stock;
      if not found then
        pantry_items_unavailable := pantry_items_unavailable+1;
        continue;
      end if;
      pantry_items_updated := pantry_items_updated+1;
      if v_stock.amount_remaining<v_item.amount then pantry_items_short:=pantry_items_short+1; end if;
      if v_stock.amount_remaining<=v_item.amount then
        delete from public.pantry where id=v_stock.id and user_id=v_user;
      else
        update public.pantry set amount_remaining=amount_remaining-v_item.amount where id=v_stock.id and user_id=v_user;
      end if;
    end loop;
  end if;
  delete from public.shopping_trips where id=p_trip_id and user_id=v_user;
  trip_deleted := true;
  return next;
end;
$$;


ALTER FUNCTION "public"."delete_shopping_trip"("p_trip_id" "uuid", "p_remove_from_pantry" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_meal_item_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
declare
  existing_item_count integer;
begin
  /*
   * Updating an ingredient without moving it to
   * another meal does not change the item count.
   */
  if tg_op = 'UPDATE'
     and new.meal_id = old.meal_id
  then
    return new;
  end if;

  /*
   * Serialise ingredient creation for this meal.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(
      'meal-items:' || new.meal_id::text,
      0
    )
  );

  select count(*)
  into existing_item_count
  from public.meal_items
  where meal_id = new.meal_id;

  if existing_item_count >= 50 then
    raise exception
      'A meal can contain a maximum of 50 items.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_meal_item_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_user_meal_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
declare
  existing_meal_count integer;
begin
  /*
   * An unchanged user_id on an update cannot affect
   * the number of meals belonging to the user.
   */
  if tg_op = 'UPDATE'
     and new.user_id = old.user_id
  then
    return new;
  end if;

  /*
   * Serialise meal creation for this specific user.
   * This prevents two simultaneous requests from both
   * passing the count check.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(
      'meal-user:' || new.user_id::text,
      0
    )
  );

  select count(*)
  into existing_meal_count
  from public.meals
  where user_id = new.user_id;

  if existing_meal_count >= 10 then
    raise exception
      'You can create a maximum of 10 meals.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_user_meal_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fill_product_image_from_corrections"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
 if new.image_url is null then
  select c.image_url into new.image_url from public.product_corrections c
  where c.product_barcode=new.barcode_number and c.image_url ~ '^https://images\.openfoodfacts\.org/'
  order by c.user_id limit 1;
 end if;
 return new;
end; $$;


ALTER FUNCTION "public"."fill_product_image_from_corrections"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_product_image_action"("p_actor" "uuid", "p_user" "uuid", "p_barcode" "text", "p_action" "text", "p_ticket" timestamp with time zone, "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
declare c public.product_corrections;
begin
 if p_action not in ('upload','approve','reject') then raise exception 'Invalid action'; end if;
 if p_action<>'upload' and not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Not authorised'; end if;
 select * into c from public.product_corrections where user_id=p_user and product_barcode=p_barcode for update;
 if not found or c.image_status is distinct from 'pending' or c.image_reviewed_by is distinct from p_actor or c.image_reviewed_at is distinct from p_ticket then
  raise exception 'Photo operation no longer available.';
 end if;
 if p_action='upload' then
  if p_actor<>p_user then raise exception 'Not authorised'; end if;
  if exists(select 1 from public.user_image_moderation where user_id=p_user and (image_upload_blocked or violation_count>=3)) then
   raise exception 'Product photo uploads are blocked for this account.';
  end if;
  update public.product_corrections set image_path='product-corrections/'||p_user::text||'/'||p_barcode||'/image.webp',
   image_status='pending',image_submitted_at=clock_timestamp(),image_reviewed_by=null,image_reviewed_at=null,image_rejection_reason=null
   where user_id=p_user and product_barcode=p_barcode;
 elsif p_action='approve' then
  update public.products set image_path='products/'||p_barcode||'/image.webp' where barcode_number=p_barcode;
  update public.product_corrections set image_status='approved',image_path=null,image_rejection_reason=null,image_reviewed_at=clock_timestamp()
   where user_id=p_user and product_barcode=p_barcode;
 else
  if p_reason is null or p_reason not in ('wrong_product','poor_quality','duplicate','personal_information','offensive','abusive','other') then raise exception 'Choose a rejection reason.'; end if;
  update public.product_corrections set image_status='rejected',image_path=null,image_rejection_reason=p_reason,image_reviewed_at=clock_timestamp()
   where user_id=p_user and product_barcode=p_barcode;
  if p_reason in ('offensive','abusive') then
   insert into public.user_image_moderation(user_id,violation_count,image_upload_blocked) values(p_user,1,false)
   on conflict(user_id) do update set violation_count=public.user_image_moderation.violation_count+1,
    image_upload_blocked=public.user_image_moderation.image_upload_blocked or public.user_image_moderation.violation_count+1>=3,updated_at=now();
  end if;
 end if;
end; $$;


ALTER FUNCTION "public"."finish_product_image_action"("p_actor" "uuid", "p_user" "uuid", "p_barcode" "text", "p_action" "text", "p_ticket" timestamp with time zone, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_product_image_review"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
 if coalesce(auth.role(),'') <> 'service_role' then
  if tg_op='DELETE' then
   if old.image_status='pending' or old.image_path is not null then
    raise exception 'A pending photo must be reviewed before removing its correction.' using errcode='42501';
   end if;
   return old;
  end if;
  if tg_op='INSERT' then
   if new.image_path is not null or new.image_status is not null or new.image_rejection_reason is not null
     or new.image_submitted_at is not null or new.image_reviewed_at is not null or new.image_reviewed_by is not null then
    raise exception 'Use the product image service.' using errcode='42501';
   end if;
  else
   if row(new.image_path,new.image_status,new.image_rejection_reason,new.image_submitted_at,new.image_reviewed_at,new.image_reviewed_by)
     is distinct from row(old.image_path,old.image_status,old.image_rejection_reason,old.image_submitted_at,old.image_reviewed_at,old.image_reviewed_by)
     or new.user_id is distinct from old.user_id or new.product_barcode is distinct from old.product_barcode then
    raise exception 'Image review fields are backend controlled.' using errcode='42501';
   end if;
  end if;
  if new.image_url is not null and (tg_op='INSERT' or new.image_url is distinct from old.image_url)
    and new.image_url !~ '^https://images\.openfoodfacts\.org/' then
   raise exception 'External image URLs must come from Open Food Facts.' using errcode='42501';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;


ALTER FUNCTION "public"."guard_product_image_review"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."food_consumption" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "consumed_on" "date" NOT NULL,
    "consumption_group_id" "uuid" NOT NULL,
    "meal_id" bigint,
    "meal_name_snapshot" "text",
    "product_barcode" "text",
    "generic_product_id" bigint,
    "product_name_snapshot" "text" NOT NULL,
    "brand_snapshot" "text",
    "amount_consumed" numeric(12,3) NOT NULL,
    "measurement_unit" "text" NOT NULL,
    "calories_consumed" numeric(18,6),
    "protein_consumed" numeric(18,6),
    "carbs_consumed" numeric(18,6),
    "fat_consumed" numeric(18,6),
    "sugars_consumed" numeric(18,6),
    "salt_consumed" numeric(18,6),
    "fibre_consumed" numeric(18,6),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meal_period" "text" DEFAULT 'Snack'::"text" NOT NULL,
    CONSTRAINT "food_consumption_calories" CHECK ((("calories_consumed" >= (0)::numeric) AND ("calories_consumed" < 'Infinity'::numeric))),
    CONSTRAINT "food_consumption_carbs" CHECK ((("carbs_consumed" >= (0)::numeric) AND ("carbs_consumed" < 'Infinity'::numeric))),
    CONSTRAINT "food_consumption_fat" CHECK ((("fat_consumed" >= (0)::numeric) AND ("fat_consumed" < 'Infinity'::numeric))),
    CONSTRAINT "food_consumption_fibre" CHECK ((("fibre_consumed" >= (0)::numeric) AND ("fibre_consumed" < 'Infinity'::numeric))),
    CONSTRAINT "food_consumption_finite_date" CHECK ("isfinite"("consumed_on")),
    CONSTRAINT "food_consumption_meal_name" CHECK ((("meal_name_snapshot" IS NULL) OR ("length"("btrim"("meal_name_snapshot")) > 0))),
    CONSTRAINT "food_consumption_meal_period_check" CHECK (("meal_period" = ANY (ARRAY['Breakfast'::"text", 'Lunch'::"text", 'Dinner'::"text", 'Snack'::"text"]))),
    CONSTRAINT "food_consumption_meal_snapshot" CHECK ((("meal_id" IS NULL) OR ("meal_name_snapshot" IS NOT NULL))),
    CONSTRAINT "food_consumption_one_product" CHECK ((("product_barcode" IS NOT NULL) <> ("generic_product_id" IS NOT NULL))),
    CONSTRAINT "food_consumption_positive_amount" CHECK ((("amount_consumed" > (0)::numeric) AND ("amount_consumed" < 'Infinity'::numeric))),
    CONSTRAINT "food_consumption_product_name" CHECK (("length"("btrim"("product_name_snapshot")) > 0)),
    CONSTRAINT "food_consumption_protein" CHECK ((("protein_consumed" >= (0)::numeric) AND ("protein_consumed" < 'Infinity'::numeric))),
    CONSTRAINT "food_consumption_salt" CHECK ((("salt_consumed" >= (0)::numeric) AND ("salt_consumed" < 'Infinity'::numeric))),
    CONSTRAINT "food_consumption_sugars" CHECK ((("sugars_consumed" >= (0)::numeric) AND ("sugars_consumed" < 'Infinity'::numeric))),
    CONSTRAINT "food_consumption_unit" CHECK (("measurement_unit" = ANY (ARRAY['g'::"text", 'ml'::"text"])))
);


ALTER TABLE "public"."food_consumption" OWNER TO "postgres";


COMMENT ON TABLE "public"."food_consumption" IS 'One snapshot row per consumed product or meal ingredient. Client writes must go through the planned logging RPC.';



COMMENT ON COLUMN "public"."food_consumption"."consumption_group_id" IS 'One eating event; log_food_consumption serializes requests per user and reuses saved groups on retry.';



CREATE OR REPLACE FUNCTION "public"."log_food_consumption"("p_group_id" "uuid", "p_consumed_on" "date", "p_time_zone" "text", "p_remove_from_pantry" boolean, "p_meal_id" bigint DEFAULT NULL::bigint, "p_product_barcode" "text" DEFAULT NULL::"text", "p_generic_product_id" bigint DEFAULT NULL::bigint, "p_amount" numeric DEFAULT NULL::numeric, "p_measurement_unit" "text" DEFAULT NULL::"text", "p_brand" "text" DEFAULT NULL::"text", "p_meal_period" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."food_consumption"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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


ALTER FUNCTION "public"."log_food_consumption"("p_group_id" "uuid", "p_consumed_on" "date", "p_time_zone" "text", "p_remove_from_pantry" boolean, "p_meal_id" bigint, "p_product_barcode" "text", "p_generic_product_id" bigint, "p_amount" numeric, "p_measurement_unit" "text", "p_brand" "text", "p_meal_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_public_meal"("p_meal_id" bigint, "p_items" "jsonb", "p_group_id" "uuid", "p_consumed_on" "date", "p_time_zone" "text", "p_remove_from_pantry" boolean, "p_meal_period" "text") RETURNS SETOF "public"."food_consumption"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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


ALTER FUNCTION "public"."log_public_meal"("p_meal_id" bigint, "p_items" "jsonb", "p_group_id" "uuid", "p_consumed_on" "date", "p_time_zone" "text", "p_remove_from_pantry" boolean, "p_meal_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_meal_selection"("p_meal_id" bigint, "p_items" "jsonb") RETURNS TABLE("product_barcode" "text", "generic_product_id" bigint, "amount" numeric, "measurement_unit" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
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


ALTER FUNCTION "public"."public_meal_selection"("p_meal_id" bigint, "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_meal_types"() RETURNS TABLE("meal_type" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
  select distinct m.meal_type from public.public_meals m order by m.meal_type;
$$;


ALTER FUNCTION "public"."public_meal_types"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_account_data"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
declare
  previous_role text := current_setting('request.jwt.claim.role', true);
  previous_claims text := current_setting('request.jwt.claims', true);
begin
  -- Auth's admin deletion connection may not carry PostgREST JWT claims.
  -- Permit the existing image-review guard for this trusted trigger only.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  delete from public.food_consumption where user_id = old.id;
  delete from public.meal_items where meal_id in (select id from public.meals where user_id = old.id);
  delete from public.meals where user_id = old.id;
  delete from public.pantry where user_id = old.id;
  delete from public.user_settings where user_id = old.id;
  delete from public.product_corrections where user_id = old.id;
  update public.product_corrections set image_reviewed_by = null where image_reviewed_by = old.id;
  delete from public.user_image_moderation where user_id = old.id;
  delete from public.admin_users where user_id = old.id;
  perform set_config('request.jwt.claim.role', coalesce(previous_role, ''), true);
  perform set_config('request.jwt.claims', coalesce(previous_claims, ''), true);
  return old;
end;
$$;


ALTER FUNCTION "public"."remove_account_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_public_meal"("p_meal_id" bigint, "p_items" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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


ALTER FUNCTION "public"."save_public_meal"("p_meal_id" bigint, "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_food_products"("p_search" "text", "p_page" integer DEFAULT 0) RETURNS TABLE("id" "text", "source" "text", "product_name" "text", "image_path" "text", "image_url" "text", "product_amount" numeric, "measurement_unit" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog'
    AS $$
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


ALTER FUNCTION "public"."search_food_products"("p_search" "text", "p_page" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_consumption_meal_period"("p_group_id" "uuid", "p_meal_period" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
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


ALTER FUNCTION "public"."set_consumption_meal_period"("p_group_id" "uuid", "p_meal_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_meal_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_meal_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_from_corrections"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$DECLARE
  selected_unit text;

BEGIN
  /*
   * Find the most commonly submitted measurement
   * unit for this barcode.
   *
   * If there is a tie, prefer the unit currently
   * stored in products.
   */
  SELECT correction.measurement_unit
  INTO selected_unit
  FROM public.product_corrections
    AS correction
  WHERE correction.product_barcode =
    NEW.product_barcode
  GROUP BY correction.measurement_unit
  ORDER BY
    COUNT(*) DESC,

    CASE
      WHEN correction.measurement_unit = (
        SELECT product.measurement_unit
        FROM public.products AS product
        WHERE product.barcode_number =
          NEW.product_barcode
      )
      THEN 0
      ELSE 1
    END,

    MIN(correction.created_at) ASC,

    correction.measurement_unit ASC
  LIMIT 1;

  /*
   * Insert a new shared product or update an
   * existing one using only corrections whose unit
   * matches the selected unit.
   */
  INSERT INTO public.products (
    barcode_number,
    product_name,
    product_amount,
    measurement_unit,
    calories_per_100,
    protein_per_100,
    carbs_per_100,
    fat_per_100,
    sugars_per_100,
    salt_per_100,
    fibre_per_100
  )
  SELECT
    NEW.product_barcode,

    /*
     * Use the most commonly submitted non-empty
     * product name among submissions using the
     * selected measurement unit.
     */
    (
      SELECT name_correction.product_name
      FROM public.product_corrections
        AS name_correction
      WHERE
        name_correction.product_barcode =
          NEW.product_barcode

        AND name_correction.measurement_unit =
          selected_unit

        AND NULLIF(
          BTRIM(name_correction.product_name),
          ''
        ) IS NOT NULL

      GROUP BY name_correction.product_name

      ORDER BY
        COUNT(*) DESC,
        name_correction.product_name ASC

      LIMIT 1
    ),

    ROUND(
      (
        PERCENTILE_CONT(0.5)
        WITHIN GROUP (
          ORDER BY correction.product_amount
        )
      )::numeric,
      2
    ),

    selected_unit,

    ROUND(
      (
        PERCENTILE_CONT(0.5)
        WITHIN GROUP (
          ORDER BY correction.calories_per_100
        )
      )::numeric,
      2
    ),

    ROUND(
      (
        PERCENTILE_CONT(0.5)
        WITHIN GROUP (
          ORDER BY correction.protein_per_100
        )
      )::numeric,
      2
    ),

    ROUND(
      (
        PERCENTILE_CONT(0.5)
        WITHIN GROUP (
          ORDER BY correction.carbs_per_100
        )
      )::numeric,
      2
    ),

    ROUND(
      (
        PERCENTILE_CONT(0.5)
        WITHIN GROUP (
          ORDER BY correction.fat_per_100
        )
      )::numeric,
      2
    ),

    ROUND(
      (
        PERCENTILE_CONT(0.5)
        WITHIN GROUP (
          ORDER BY correction.sugars_per_100
        )
      )::numeric,
      2
    ),

    ROUND(
      (
        PERCENTILE_CONT(0.5)
        WITHIN GROUP (
          ORDER BY correction.salt_per_100
        )
      )::numeric,
      2
    ),

    ROUND(
      (
        PERCENTILE_CONT(0.5)
        WITHIN GROUP (
          ORDER BY correction.fibre_per_100
        )
      )::numeric,
      2
    )

  FROM public.product_corrections
    AS correction

  WHERE
    correction.product_barcode =
      NEW.product_barcode

    AND correction.measurement_unit =
      selected_unit

  ON CONFLICT (barcode_number)
  DO UPDATE SET
    product_name = COALESCE(
      EXCLUDED.product_name,
      products.product_name
    ),

    /*
     * If the selected unit changes, do not preserve
     * numeric values belonging to the previous unit.
     */
    product_amount =
      CASE
        WHEN products.measurement_unit
          IS DISTINCT FROM
          EXCLUDED.measurement_unit
        THEN EXCLUDED.product_amount
        ELSE COALESCE(
          EXCLUDED.product_amount,
          products.product_amount
        )
      END,

    calories_per_100 =
      CASE
        WHEN products.measurement_unit
          IS DISTINCT FROM
          EXCLUDED.measurement_unit
        THEN EXCLUDED.calories_per_100
        ELSE COALESCE(
          EXCLUDED.calories_per_100,
          products.calories_per_100
        )
      END,

    protein_per_100 =
      CASE
        WHEN products.measurement_unit
          IS DISTINCT FROM
          EXCLUDED.measurement_unit
        THEN EXCLUDED.protein_per_100
        ELSE COALESCE(
          EXCLUDED.protein_per_100,
          products.protein_per_100
        )
      END,

    carbs_per_100 =
      CASE
        WHEN products.measurement_unit
          IS DISTINCT FROM
          EXCLUDED.measurement_unit
        THEN EXCLUDED.carbs_per_100
        ELSE COALESCE(
          EXCLUDED.carbs_per_100,
          products.carbs_per_100
        )
      END,

    fat_per_100 =
      CASE
        WHEN products.measurement_unit
          IS DISTINCT FROM
          EXCLUDED.measurement_unit
        THEN EXCLUDED.fat_per_100
        ELSE COALESCE(
          EXCLUDED.fat_per_100,
          products.fat_per_100
        )
      END,

    sugars_per_100 =
      CASE
        WHEN products.measurement_unit
          IS DISTINCT FROM
          EXCLUDED.measurement_unit
        THEN EXCLUDED.sugars_per_100
        ELSE COALESCE(
          EXCLUDED.sugars_per_100,
          products.sugars_per_100
        )
      END,

    salt_per_100 =
      CASE
        WHEN products.measurement_unit
          IS DISTINCT FROM
          EXCLUDED.measurement_unit
        THEN EXCLUDED.salt_per_100
        ELSE COALESCE(
          EXCLUDED.salt_per_100,
          products.salt_per_100
        )
      END,

    fibre_per_100 =
      CASE
        WHEN products.measurement_unit
          IS DISTINCT FROM
          EXCLUDED.measurement_unit
        THEN EXCLUDED.fibre_per_100
        ELSE COALESCE(
          EXCLUDED.fibre_per_100,
          products.fibre_per_100
        )
      END,

    measurement_unit =
      EXCLUDED.measurement_unit;

  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."update_product_from_corrections"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


ALTER TABLE "public"."food_consumption" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."food_consumption_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."food_groups" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group_name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "food_groups_name_not_blank" CHECK (("btrim"("group_name") <> ''::"text"))
);


ALTER TABLE "public"."food_groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."food_groups" IS 'Broad culinary groups used for related-food suggestions; these rows have no nutrition profile.';



ALTER TABLE "public"."food_groups" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."food_groups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."generic_products" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "product_name" "text" NOT NULL,
    "measurement_unit" "text" NOT NULL,
    "default_amount" numeric NOT NULL,
    "calories_per_100" numeric,
    "protein_per_100" numeric,
    "carbs_per_100" numeric,
    "fat_per_100" numeric,
    "sugars_per_100" numeric,
    "salt_per_100" numeric,
    "fibre_per_100" numeric,
    "image_path" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "food_group_id" bigint,
    CONSTRAINT "generic_products_amount_check" CHECK ((("default_amount" > (0)::numeric) AND ("default_amount" <= (100000)::numeric))),
    CONSTRAINT "generic_products_calories_check" CHECK ((("calories_per_100" IS NULL) OR (("calories_per_100" >= (0)::numeric) AND ("calories_per_100" <= (1000)::numeric)))),
    CONSTRAINT "generic_products_carbs_check" CHECK ((("carbs_per_100" IS NULL) OR (("carbs_per_100" >= (0)::numeric) AND ("carbs_per_100" <= (100)::numeric)))),
    CONSTRAINT "generic_products_fat_check" CHECK ((("fat_per_100" IS NULL) OR (("fat_per_100" >= (0)::numeric) AND ("fat_per_100" <= (100)::numeric)))),
    CONSTRAINT "generic_products_fibre_check" CHECK ((("fibre_per_100" IS NULL) OR (("fibre_per_100" >= (0)::numeric) AND ("fibre_per_100" <= (100)::numeric)))),
    CONSTRAINT "generic_products_name_check" CHECK ((("char_length"("btrim"("product_name")) >= 2) AND ("char_length"("btrim"("product_name")) <= 150))),
    CONSTRAINT "generic_products_protein_check" CHECK ((("protein_per_100" IS NULL) OR (("protein_per_100" >= (0)::numeric) AND ("protein_per_100" <= (100)::numeric)))),
    CONSTRAINT "generic_products_salt_check" CHECK ((("salt_per_100" IS NULL) OR (("salt_per_100" >= (0)::numeric) AND ("salt_per_100" <= (100)::numeric)))),
    CONSTRAINT "generic_products_sugars_check" CHECK ((("sugars_per_100" IS NULL) OR (("sugars_per_100" >= (0)::numeric) AND ("sugars_per_100" <= (100)::numeric)))),
    CONSTRAINT "generic_products_unit_check" CHECK (("measurement_unit" = ANY (ARRAY['g'::"text", 'ml'::"text"])))
);


ALTER TABLE "public"."generic_products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."generic_products"."image_path" IS 'Optional product image URL. NULL displays the default placeholder.';



COMMENT ON COLUMN "public"."generic_products"."is_active" IS 'False hides a generic food without deleting an ID referenced by existing user data.';



COMMENT ON COLUMN "public"."generic_products"."food_group_id" IS 'One broad culinary substitution group used after exact generic-product and name matching.';



ALTER TABLE "public"."generic_products" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."generic_products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."meal_items" (
    "id" bigint NOT NULL,
    "meal_id" bigint NOT NULL,
    "product_barcode" "text",
    "generic_product_id" bigint,
    "amount" numeric(12,3) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "meal_items_amount_check" CHECK ((("amount" > (0)::numeric) AND ("amount" <= (100000)::numeric))),
    CONSTRAINT "meal_items_one_product_type_check" CHECK (((("product_barcode" IS NOT NULL) AND ("generic_product_id" IS NULL)) OR (("product_barcode" IS NULL) AND ("generic_product_id" IS NOT NULL))))
);


ALTER TABLE "public"."meal_items" OWNER TO "postgres";


ALTER TABLE "public"."meal_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."meal_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."meals" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "meal_name" "text" NOT NULL,
    "description" "text",
    "instructions" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_path" "text",
    "public_image_path" "text",
    CONSTRAINT "meals_description_check" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 500))),
    CONSTRAINT "meals_instructions_check" CHECK ((("instructions" IS NULL) OR ("char_length"("instructions") <= 5000))),
    CONSTRAINT "meals_name_check" CHECK ((("char_length"("btrim"("meal_name")) >= 1) AND ("char_length"("btrim"("meal_name")) <= 100)))
);


ALTER TABLE "public"."meals" OWNER TO "postgres";


COMMENT ON COLUMN "public"."meals"."image_path" IS 'Private R2 key: meals/{user_id}/{meal_id}/image.webp. Legacy paths remain readable until replaced or removed.';



ALTER TABLE "public"."meals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."meals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."pantry" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_barcode" "text",
    "quantity" integer DEFAULT 1 NOT NULL,
    "id" bigint NOT NULL,
    "generic_product_id" bigint,
    "amount_remaining" numeric(12,3) NOT NULL,
    CONSTRAINT "pantry_amount_remaining_check" CHECK ((("amount_remaining" > (0)::numeric) AND ("amount_remaining" <= (100000000)::numeric))),
    CONSTRAINT "pantry_one_product_type_check" CHECK (((("product_barcode" IS NOT NULL) AND ("generic_product_id" IS NULL)) OR (("product_barcode" IS NULL) AND ("generic_product_id" IS NOT NULL)))),
    CONSTRAINT "pantry_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."pantry" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pantry"."amount_remaining" IS 'Canonical amount of this product remaining in the pantry, measured in the product measurement unit.';



ALTER TABLE "public"."pantry" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pantry_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."product_corrections" (
    "product_barcode" "text" NOT NULL,
    "product_name" "text",
    "user_id" "uuid" NOT NULL,
    "product_amount" numeric,
    "calories_per_100" numeric,
    "protein_per_100" numeric,
    "carbs_per_100" numeric,
    "fat_per_100" numeric,
    "sugars_per_100" numeric,
    "salt_per_100" numeric,
    "fibre_per_100" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "measurement_unit" "text" NOT NULL,
    "image_url" "text",
    "image_path" "text",
    "image_status" "text",
    "image_rejection_reason" "text",
    "image_submitted_at" timestamp with time zone,
    "image_reviewed_at" timestamp with time zone,
    "image_reviewed_by" "uuid",
    CONSTRAINT "product_corrections_calories_per_100g_check" CHECK ((("calories_per_100" IS NULL) OR (("calories_per_100" >= (0)::numeric) AND ("calories_per_100" <= (1000)::numeric)))),
    CONSTRAINT "product_corrections_carbs_per_100g_check" CHECK ((("carbs_per_100" IS NULL) OR (("carbs_per_100" >= (0)::numeric) AND ("carbs_per_100" <= (100)::numeric)))),
    CONSTRAINT "product_corrections_fat_per_100g_check" CHECK ((("fat_per_100" IS NULL) OR (("fat_per_100" >= (0)::numeric) AND ("fat_per_100" <= (100)::numeric)))),
    CONSTRAINT "product_corrections_fibre_per_100g_check" CHECK ((("fibre_per_100" IS NULL) OR (("fibre_per_100" >= (0)::numeric) AND ("fibre_per_100" <= (100)::numeric)))),
    CONSTRAINT "product_corrections_image_rejection_reason_check" CHECK (("image_rejection_reason" = ANY (ARRAY['wrong_product'::"text", 'poor_quality'::"text", 'duplicate'::"text", 'personal_information'::"text", 'offensive'::"text", 'abusive'::"text", 'other'::"text"]))),
    CONSTRAINT "product_corrections_image_status_check" CHECK (("image_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "product_corrections_measurement_unit_check" CHECK (("measurement_unit" = ANY (ARRAY['g'::"text", 'ml'::"text"]))),
    CONSTRAINT "product_corrections_product_barcode_check" CHECK (("product_barcode" ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'::"text")),
    CONSTRAINT "product_corrections_product_name_check" CHECK ((("product_name" IS NULL) OR (("char_length"("btrim"("product_name")) >= 1) AND ("char_length"("btrim"("product_name")) <= 200)))),
    CONSTRAINT "product_corrections_product_weight_check" CHECK ((("product_amount" IS NULL) OR (("product_amount" > (0)::numeric) AND ("product_amount" <= (100000)::numeric)))),
    CONSTRAINT "product_corrections_protein_per_100g_check" CHECK ((("protein_per_100" IS NULL) OR (("protein_per_100" >= (0)::numeric) AND ("protein_per_100" <= (100)::numeric)))),
    CONSTRAINT "product_corrections_salt_per_100g_check" CHECK ((("salt_per_100" IS NULL) OR (("salt_per_100" >= (0)::numeric) AND ("salt_per_100" <= (100)::numeric)))),
    CONSTRAINT "product_corrections_sugars_per_100g_check" CHECK ((("sugars_per_100" IS NULL) OR (("sugars_per_100" >= (0)::numeric) AND ("sugars_per_100" <= (100)::numeric))))
);


ALTER TABLE "public"."product_corrections" OWNER TO "postgres";


COMMENT ON COLUMN "public"."product_corrections"."image_url" IS 'Optional product image URL saved with this correction.';



CREATE TABLE IF NOT EXISTS "public"."products" (
    "barcode_number" "text" NOT NULL,
    "product_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "calories_per_100" numeric,
    "protein_per_100" numeric,
    "carbs_per_100" numeric,
    "fat_per_100" numeric,
    "sugars_per_100" numeric,
    "salt_per_100" numeric,
    "fibre_per_100" numeric,
    "product_amount" numeric,
    "measurement_unit" "text" NOT NULL,
    "image_url" "text",
    "image_path" "text",
    "generic_product_id" bigint,
    CONSTRAINT "products_barcode_number_check" CHECK (("barcode_number" ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'::"text")),
    CONSTRAINT "products_calories_per_100_check" CHECK ((("calories_per_100" IS NULL) OR (("calories_per_100" >= (0)::numeric) AND ("calories_per_100" <= (1000)::numeric)))),
    CONSTRAINT "products_carbs_per_100_check" CHECK ((("carbs_per_100" IS NULL) OR (("carbs_per_100" >= (0)::numeric) AND ("carbs_per_100" <= (100)::numeric)))),
    CONSTRAINT "products_fat_per_100_check" CHECK ((("fat_per_100" IS NULL) OR (("fat_per_100" >= (0)::numeric) AND ("fat_per_100" <= (100)::numeric)))),
    CONSTRAINT "products_fibre_per_100_check" CHECK ((("fibre_per_100" IS NULL) OR (("fibre_per_100" >= (0)::numeric) AND ("fibre_per_100" <= (100)::numeric)))),
    CONSTRAINT "products_measurement_unit_check" CHECK (("measurement_unit" = ANY (ARRAY['g'::"text", 'ml'::"text"]))),
    CONSTRAINT "products_product_amount_check" CHECK ((("product_amount" IS NULL) OR (("product_amount" > (0)::numeric) AND ("product_amount" <= (100000)::numeric)))),
    CONSTRAINT "products_protein_per_100_check" CHECK ((("protein_per_100" IS NULL) OR (("protein_per_100" >= (0)::numeric) AND ("protein_per_100" <= (100)::numeric)))),
    CONSTRAINT "products_salt_per_100_check" CHECK ((("salt_per_100" IS NULL) OR (("salt_per_100" >= (0)::numeric) AND ("salt_per_100" <= (100)::numeric)))),
    CONSTRAINT "products_sugars_per_100_check" CHECK ((("sugars_per_100" IS NULL) OR (("sugars_per_100" >= (0)::numeric) AND ("sugars_per_100" <= (100)::numeric))))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."image_url" IS 'Optional external product image URL; currently sourced from Open Food Facts.';



COMMENT ON COLUMN "public"."products"."generic_product_id" IS 'The branded product''s exact generic food, used for exact pantry and nutrition matching.';



CREATE TABLE IF NOT EXISTS "public"."public_meal_ingredients" (
    "id" bigint NOT NULL,
    "public_meal_id" bigint NOT NULL,
    "generic_product_id" bigint NOT NULL,
    "amount" numeric(12,3) NOT NULL,
    "measurement_unit" "text" NOT NULL,
    "is_optional" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "name" "text",
    CONSTRAINT "public_meal_ingredients_amount_check" CHECK ((("amount" > (0)::numeric) AND ("amount" <= (100000)::numeric))),
    CONSTRAINT "public_meal_ingredients_measurement_unit_check" CHECK (("measurement_unit" = ANY (ARRAY['g'::"text", 'ml'::"text"]))),
    CONSTRAINT "public_meal_ingredients_name_check" CHECK ((("name" IS NULL) OR ("btrim"("name") <> ''::"text")))
);


ALTER TABLE "public"."public_meal_ingredients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."public_meal_ingredients"."name" IS 'Optional recipe ingredient label, e.g. Frozen mangoes. NULL displays the generic product name. Does not affect pantry matching.';



ALTER TABLE "public"."public_meal_ingredients" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."public_meal_ingredients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."public_meals" (
    "id" bigint NOT NULL,
    "meal_name" "text" NOT NULL,
    "description" "text",
    "instructions" "text",
    "image_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meal_type" "text" DEFAULT 'Other'::"text" NOT NULL,
    CONSTRAINT "public_meals_description_check" CHECK (("length"("description") <= 500)),
    CONSTRAINT "public_meals_instructions_check" CHECK (("length"("instructions") <= 5000)),
    CONSTRAINT "public_meals_meal_name_check" CHECK ((("length"("btrim"("meal_name")) >= 1) AND ("length"("btrim"("meal_name")) <= 100))),
    CONSTRAINT "public_meals_meal_type_check" CHECK (("meal_type" = ANY (ARRAY['Quick meals'::"text", '30-minute meals'::"text", 'High-protein meals'::"text", 'Budget meals'::"text", 'Slow-cooker meals'::"text", 'Breakfast'::"text", 'Lunch'::"text", 'Dinner'::"text", 'Snacks'::"text", 'Desserts'::"text", 'Other'::"text"])))
);


ALTER TABLE "public"."public_meals" OWNER TO "postgres";


ALTER TABLE "public"."public_meals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."public_meals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."shopping_trip_items" (
    "id" bigint NOT NULL,
    "shopping_trip_id" "uuid" NOT NULL,
    "product_barcode" "text",
    "generic_product_id" bigint,
    "product_name_snapshot" "text" NOT NULL,
    "brand_snapshot" "text",
    "amount_purchased" numeric(12,3) NOT NULL,
    "measurement_unit" "text" NOT NULL,
    "price_paid" numeric(12,2) NOT NULL,
    "calorie_percentage" numeric,
    "protein_percentage" numeric,
    "overall_grade" "text",
    CONSTRAINT "shopping_trip_items_amount_purchased_check" CHECK ((("amount_purchased" > (0)::numeric) AND ("amount_purchased" <= (100000000)::numeric))),
    CONSTRAINT "shopping_trip_items_check" CHECK ((("product_barcode" IS NULL) <> ("generic_product_id" IS NULL))),
    CONSTRAINT "shopping_trip_items_measurement_unit_check" CHECK (("measurement_unit" = ANY (ARRAY['g'::"text", 'ml'::"text"]))),
    CONSTRAINT "shopping_trip_items_overall_grade_check" CHECK (("overall_grade" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text", 'E'::"text"]))),
    CONSTRAINT "shopping_trip_items_price_paid_check" CHECK ((("price_paid" >= (0)::numeric) AND ("price_paid" < 'Infinity'::numeric)))
);


ALTER TABLE "public"."shopping_trip_items" OWNER TO "postgres";


ALTER TABLE "public"."shopping_trip_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."shopping_trip_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."shopping_trips" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_spent" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shopping_trips_total_spent_check" CHECK ((("total_spent" >= (0)::numeric) AND ("total_spent" < 'Infinity'::numeric)))
);


ALTER TABLE "public"."shopping_trips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_image_moderation" (
    "user_id" "uuid" NOT NULL,
    "violation_count" integer DEFAULT 0 NOT NULL,
    "image_upload_blocked" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_image_moderation_violation_count_check" CHECK (("violation_count" >= 0))
);


ALTER TABLE "public"."user_image_moderation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "calories_target_per_day" integer DEFAULT 2000,
    "protein_target_per_day" integer DEFAULT 100,
    "user_id" "uuid" NOT NULL,
    "carbs_target_per_day" integer DEFAULT 350,
    "fat_target_per_day" integer DEFAULT 70,
    "sugars_target_per_day" integer DEFAULT 90,
    "salt_target_per_day" integer DEFAULT 6,
    "fibre_target_per_day" integer DEFAULT 30,
    "cost_target_per_day" numeric DEFAULT '3'::numeric
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."food_consumption"
    ADD CONSTRAINT "food_consumption_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_groups"
    ADD CONSTRAINT "food_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generic_products"
    ADD CONSTRAINT "generic_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meal_items"
    ADD CONSTRAINT "meal_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meals"
    ADD CONSTRAINT "meals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pantry"
    ADD CONSTRAINT "pantry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pantry"
    ADD CONSTRAINT "pantry_user_barcode_unique" UNIQUE ("user_id", "product_barcode");



ALTER TABLE ONLY "public"."pantry"
    ADD CONSTRAINT "pantry_user_generic_product_unique" UNIQUE ("user_id", "generic_product_id");



ALTER TABLE ONLY "public"."product_corrections"
    ADD CONSTRAINT "product_corrections_pkey" PRIMARY KEY ("product_barcode", "user_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("barcode_number");



ALTER TABLE ONLY "public"."public_meal_ingredients"
    ADD CONSTRAINT "public_meal_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_meals"
    ADD CONSTRAINT "public_meals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopping_trip_items"
    ADD CONSTRAINT "shopping_trip_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopping_trips"
    ADD CONSTRAINT "shopping_trips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_image_moderation"
    ADD CONSTRAINT "user_image_moderation_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "food_consumption_barcode_idx" ON "public"."food_consumption" USING "btree" ("product_barcode") WHERE ("product_barcode" IS NOT NULL);



CREATE INDEX "food_consumption_generic_idx" ON "public"."food_consumption" USING "btree" ("generic_product_id") WHERE ("generic_product_id" IS NOT NULL);



CREATE INDEX "food_consumption_meal_idx" ON "public"."food_consumption" USING "btree" ("meal_id") WHERE ("meal_id" IS NOT NULL);



CREATE INDEX "food_consumption_user_date_idx" ON "public"."food_consumption" USING "btree" ("user_id", "consumed_on");



CREATE INDEX "food_consumption_user_group_idx" ON "public"."food_consumption" USING "btree" ("user_id", "consumption_group_id");



CREATE INDEX "food_groups_active_name_idx" ON "public"."food_groups" USING "btree" ("is_active", "group_name");



CREATE UNIQUE INDEX "food_groups_group_name_ci_uidx" ON "public"."food_groups" USING "btree" ("lower"(TRIM(BOTH FROM "group_name")));



CREATE UNIQUE INDEX "food_groups_group_name_lower_uidx" ON "public"."food_groups" USING "btree" ("lower"(TRIM(BOTH FROM "group_name")));



CREATE INDEX "generic_products_active_name_idx" ON "public"."generic_products" USING "btree" ("is_active", "product_name");



CREATE INDEX "generic_products_food_group_id_idx" ON "public"."generic_products" USING "btree" ("food_group_id");



CREATE INDEX "generic_products_name_index" ON "public"."generic_products" USING "btree" ("lower"("product_name"));



CREATE INDEX "generic_products_name_trgm_idx" ON "public"."generic_products" USING "gin" ("product_name" "extensions"."gin_trgm_ops");



CREATE UNIQUE INDEX "generic_products_product_name_ci_uidx" ON "public"."generic_products" USING "btree" ("lower"(TRIM(BOTH FROM "product_name")));



CREATE UNIQUE INDEX "generic_products_unique_normalised_name" ON "public"."generic_products" USING "btree" ("lower"("btrim"("product_name")));



CREATE UNIQUE INDEX "meal_items_barcode_unique" ON "public"."meal_items" USING "btree" ("meal_id", "product_barcode") WHERE ("product_barcode" IS NOT NULL);



CREATE UNIQUE INDEX "meal_items_generic_unique" ON "public"."meal_items" USING "btree" ("meal_id", "generic_product_id") WHERE ("generic_product_id" IS NOT NULL);



CREATE INDEX "meal_items_meal_index" ON "public"."meal_items" USING "btree" ("meal_id", "created_at");



CREATE UNIQUE INDEX "meals_user_name_unique" ON "public"."meals" USING "btree" ("user_id", "lower"("btrim"("meal_name")));



CREATE INDEX "meals_user_updated_index" ON "public"."meals" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "product_images_pending_idx" ON "public"."product_corrections" USING "btree" ("image_submitted_at") WHERE ("image_status" = 'pending'::"text");



CREATE INDEX "products_generic_product_id_idx" ON "public"."products" USING "btree" ("generic_product_id");



CREATE INDEX "products_name_trgm_idx" ON "public"."products" USING "gin" ("product_name" "extensions"."gin_trgm_ops");



CREATE INDEX "public_meal_ingredients_meal_idx" ON "public"."public_meal_ingredients" USING "btree" ("public_meal_id", "sort_order", "id");



CREATE INDEX "public_meals_type_id_idx" ON "public"."public_meals" USING "btree" ("meal_type", "id");



CREATE INDEX "shopping_trip_items_trip_idx" ON "public"."shopping_trip_items" USING "btree" ("shopping_trip_id");



CREATE INDEX "shopping_trips_user_date_idx" ON "public"."shopping_trips" USING "btree" ("user_id", "completed_at");



CREATE OR REPLACE TRIGGER "enforce_meal_item_limit_trigger" BEFORE INSERT OR UPDATE OF "meal_id" ON "public"."meal_items" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_meal_item_limit"();



CREATE OR REPLACE TRIGGER "enforce_user_meal_limit_trigger" BEFORE INSERT OR UPDATE OF "user_id" ON "public"."meals" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_user_meal_limit"();



CREATE OR REPLACE TRIGGER "fill_product_image" BEFORE INSERT OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."fill_product_image_from_corrections"();



CREATE OR REPLACE TRIGGER "guard_product_image_review" BEFORE INSERT OR DELETE OR UPDATE ON "public"."product_corrections" FOR EACH ROW EXECUTE FUNCTION "public"."guard_product_image_review"();



CREATE OR REPLACE TRIGGER "set_meal_items_updated_at_trigger" BEFORE UPDATE ON "public"."meal_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_meal_updated_at"();



CREATE OR REPLACE TRIGGER "set_meals_updated_at_trigger" BEFORE UPDATE ON "public"."meals" FOR EACH ROW EXECUTE FUNCTION "public"."set_meal_updated_at"();



CREATE OR REPLACE TRIGGER "update_product_after_correction" AFTER INSERT OR UPDATE ON "public"."product_corrections" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_from_corrections"();



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_consumption"
    ADD CONSTRAINT "food_consumption_generic_product_id_fkey" FOREIGN KEY ("generic_product_id") REFERENCES "public"."generic_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."food_consumption"
    ADD CONSTRAINT "food_consumption_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."food_consumption"
    ADD CONSTRAINT "food_consumption_product_barcode_fkey" FOREIGN KEY ("product_barcode") REFERENCES "public"."products"("barcode_number") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."food_consumption"
    ADD CONSTRAINT "food_consumption_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generic_products"
    ADD CONSTRAINT "generic_products_food_group_id_fkey" FOREIGN KEY ("food_group_id") REFERENCES "public"."food_groups"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meal_items"
    ADD CONSTRAINT "meal_items_generic_product_id_fkey" FOREIGN KEY ("generic_product_id") REFERENCES "public"."generic_products"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."meal_items"
    ADD CONSTRAINT "meal_items_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meal_items"
    ADD CONSTRAINT "meal_items_product_barcode_fkey" FOREIGN KEY ("product_barcode") REFERENCES "public"."products"("barcode_number") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."meals"
    ADD CONSTRAINT "meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pantry"
    ADD CONSTRAINT "pantry_generic_product_id_fkey" FOREIGN KEY ("generic_product_id") REFERENCES "public"."generic_products"("id");



ALTER TABLE ONLY "public"."pantry"
    ADD CONSTRAINT "pantry_product_barcide_fkey" FOREIGN KEY ("product_barcode") REFERENCES "public"."products"("barcode_number") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pantry"
    ADD CONSTRAINT "pantry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_corrections"
    ADD CONSTRAINT "product_corrections_image_reviewed_by_fkey" FOREIGN KEY ("image_reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_corrections"
    ADD CONSTRAINT "product_corrections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_generic_product_id_fkey" FOREIGN KEY ("generic_product_id") REFERENCES "public"."generic_products"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."public_meal_ingredients"
    ADD CONSTRAINT "public_meal_ingredients_generic_product_id_fkey" FOREIGN KEY ("generic_product_id") REFERENCES "public"."generic_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."public_meal_ingredients"
    ADD CONSTRAINT "public_meal_ingredients_public_meal_id_fkey" FOREIGN KEY ("public_meal_id") REFERENCES "public"."public_meals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopping_trip_items"
    ADD CONSTRAINT "shopping_trip_items_shopping_trip_id_fkey" FOREIGN KEY ("shopping_trip_id") REFERENCES "public"."shopping_trips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopping_trips"
    ADD CONSTRAINT "shopping_trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_image_moderation"
    ADD CONSTRAINT "user_image_moderation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Admins manage public ingredients" ON "public"."public_meal_ingredients" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins manage public recipes" ON "public"."public_meals" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Authenticated users can delete pantry" ON "public"."pantry" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can insert pantry" ON "public"."pantry" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can insert product_corrections" ON "public"."product_corrections" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Authenticated users can insert user_settings" ON "public"."user_settings" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can read generic products" ON "public"."generic_products" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read pantry" ON "public"."pantry" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can read product_corrections" ON "public"."product_corrections" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Authenticated users can read products" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can read user_settings" ON "public"."user_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update pantry" ON "public"."pantry" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can update product_corrections" ON "public"."product_corrections" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Authenticated users can update user_settings" ON "public"."user_settings" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Food groups are publicly readable" ON "public"."food_groups" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Read own admin membership" ON "public"."admin_users" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Read own shopping items" ON "public"."shopping_trip_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."shopping_trips" "t"
  WHERE (("t"."id" = "shopping_trip_items"."shopping_trip_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Read own shopping trips" ON "public"."shopping_trips" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Read public ingredients" ON "public"."public_meal_ingredients" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Read public recipes" ON "public"."public_meals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create their own meal items" ON "public"."meal_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meals" "parent_meal"
  WHERE (("parent_meal"."id" = "meal_items"."meal_id") AND ("parent_meal"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can create their own meals" ON "public"."meals" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own meal items" ON "public"."meal_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."meals" "parent_meal"
  WHERE (("parent_meal"."id" = "meal_items"."meal_id") AND ("parent_meal"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete their own meals" ON "public"."meals" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read their own meal items" ON "public"."meal_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."meals" "parent_meal"
  WHERE (("parent_meal"."id" = "meal_items"."meal_id") AND ("parent_meal"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can read their own meals" ON "public"."meals" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own meal items" ON "public"."meal_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."meals" "parent_meal"
  WHERE (("parent_meal"."id" = "meal_items"."meal_id") AND ("parent_meal"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meals" "parent_meal"
  WHERE (("parent_meal"."id" = "meal_items"."meal_id") AND ("parent_meal"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update their own meals" ON "public"."meals" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users read their own food consumption" ON "public"."food_consumption" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_consumption" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."generic_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meal_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pantry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_corrections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_meal_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_meals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopping_trip_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopping_trips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_image_moderation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."begin_product_image_action"("p_actor" "uuid", "p_user" "uuid", "p_barcode" "text", "p_action" "text", "p_submitted" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."begin_product_image_action"("p_actor" "uuid", "p_user" "uuid", "p_barcode" "text", "p_action" "text", "p_submitted" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_shopping"("p_trip_id" "uuid", "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_shopping"("p_trip_id" "uuid", "p_items" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."complete_shopping"("p_trip_id" "uuid", "p_items" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."consume_meal_from_pantry"("p_meal_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_meal_from_pantry"("p_meal_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."consume_meal_from_pantry"("p_meal_id" bigint) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."delete_food_consumption"("p_group_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_food_consumption"("p_group_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_food_consumption"("p_group_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."delete_shopping_trip"("p_trip_id" "uuid", "p_remove_from_pantry" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_shopping_trip"("p_trip_id" "uuid", "p_remove_from_pantry" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_shopping_trip"("p_trip_id" "uuid", "p_remove_from_pantry" boolean) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."enforce_meal_item_limit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_meal_item_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_user_meal_limit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_user_meal_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fill_product_image_from_corrections"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fill_product_image_from_corrections"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."finish_product_image_action"("p_actor" "uuid", "p_user" "uuid", "p_barcode" "text", "p_action" "text", "p_ticket" timestamp with time zone, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finish_product_image_action"("p_actor" "uuid", "p_user" "uuid", "p_barcode" "text", "p_action" "text", "p_ticket" timestamp with time zone, "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_product_image_review"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_product_image_review"() TO "service_role";



GRANT ALL ON TABLE "public"."food_consumption" TO "service_role";
GRANT SELECT ON TABLE "public"."food_consumption" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."log_food_consumption"("p_group_id" "uuid", "p_consumed_on" "date", "p_time_zone" "text", "p_remove_from_pantry" boolean, "p_meal_id" bigint, "p_product_barcode" "text", "p_generic_product_id" bigint, "p_amount" numeric, "p_measurement_unit" "text", "p_brand" "text", "p_meal_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_food_consumption"("p_group_id" "uuid", "p_consumed_on" "date", "p_time_zone" "text", "p_remove_from_pantry" boolean, "p_meal_id" bigint, "p_product_barcode" "text", "p_generic_product_id" bigint, "p_amount" numeric, "p_measurement_unit" "text", "p_brand" "text", "p_meal_period" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."log_food_consumption"("p_group_id" "uuid", "p_consumed_on" "date", "p_time_zone" "text", "p_remove_from_pantry" boolean, "p_meal_id" bigint, "p_product_barcode" "text", "p_generic_product_id" bigint, "p_amount" numeric, "p_measurement_unit" "text", "p_brand" "text", "p_meal_period" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."log_public_meal"("p_meal_id" bigint, "p_items" "jsonb", "p_group_id" "uuid", "p_consumed_on" "date", "p_time_zone" "text", "p_remove_from_pantry" boolean, "p_meal_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_public_meal"("p_meal_id" bigint, "p_items" "jsonb", "p_group_id" "uuid", "p_consumed_on" "date", "p_time_zone" "text", "p_remove_from_pantry" boolean, "p_meal_period" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."log_public_meal"("p_meal_id" bigint, "p_items" "jsonb", "p_group_id" "uuid", "p_consumed_on" "date", "p_time_zone" "text", "p_remove_from_pantry" boolean, "p_meal_period" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."public_meal_selection"("p_meal_id" bigint, "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_meal_selection"("p_meal_id" bigint, "p_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_meal_types"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_meal_types"() TO "service_role";
GRANT ALL ON FUNCTION "public"."public_meal_types"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."remove_account_data"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_account_data"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_public_meal"("p_meal_id" bigint, "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_public_meal"("p_meal_id" bigint, "p_items" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."save_public_meal"("p_meal_id" bigint, "p_items" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."search_food_products"("p_search" "text", "p_page" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_food_products"("p_search" "text", "p_page" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_food_products"("p_search" "text", "p_page" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_consumption_meal_period"("p_group_id" "uuid", "p_meal_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_consumption_meal_period"("p_group_id" "uuid", "p_meal_period" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."set_consumption_meal_period"("p_group_id" "uuid", "p_meal_period" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_meal_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_meal_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_from_corrections"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_from_corrections"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_from_corrections"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "service_role";
GRANT SELECT ON TABLE "public"."admin_users" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."food_consumption_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food_groups" TO "anon";
GRANT ALL ON TABLE "public"."food_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."food_groups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_groups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_groups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_groups_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."generic_products" TO "anon";
GRANT ALL ON TABLE "public"."generic_products" TO "authenticated";
GRANT ALL ON TABLE "public"."generic_products" TO "service_role";



GRANT ALL ON SEQUENCE "public"."generic_products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."generic_products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."generic_products_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."meal_items" TO "authenticated";
GRANT ALL ON TABLE "public"."meal_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."meal_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."meal_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."meal_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."meals" TO "authenticated";
GRANT ALL ON TABLE "public"."meals" TO "service_role";



GRANT ALL ON SEQUENCE "public"."meals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."meals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."meals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pantry" TO "anon";
GRANT ALL ON TABLE "public"."pantry" TO "authenticated";
GRANT ALL ON TABLE "public"."pantry" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pantry_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pantry_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pantry_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_corrections" TO "anon";
GRANT ALL ON TABLE "public"."product_corrections" TO "authenticated";
GRANT ALL ON TABLE "public"."product_corrections" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."public_meal_ingredients" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."public_meal_ingredients" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."public_meal_ingredients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."public_meal_ingredients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."public_meal_ingredients_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."public_meals" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."public_meals" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."public_meals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."public_meals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."public_meals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shopping_trip_items" TO "service_role";
GRANT SELECT ON TABLE "public"."shopping_trip_items" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."shopping_trip_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shopping_trips" TO "service_role";
GRANT SELECT ON TABLE "public"."shopping_trips" TO "authenticated";



GRANT ALL ON TABLE "public"."user_image_moderation" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







