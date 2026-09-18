-- Run in Supabase SQL Editor. Completed shopping history is read-only.
begin;
create table public.shopping_trips (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  total_spent numeric(12,2) not null check (total_spent >= 0 and total_spent < 'Infinity'::numeric),
  created_at timestamptz not null default now()
);
create index shopping_trips_user_date_idx on public.shopping_trips(user_id, completed_at);
create table public.shopping_trip_items (
  id bigint generated always as identity primary key,
  shopping_trip_id uuid not null references public.shopping_trips(id) on delete cascade,
  -- References are snapshots: history survives catalogue changes/removal.
  product_barcode text,
  generic_product_id bigint,
  product_name_snapshot text not null,
  brand_snapshot text,
  amount_purchased numeric(12,3) not null check (amount_purchased > 0 and amount_purchased <= 100000000),
  measurement_unit text not null check (measurement_unit in ('g','ml')),
  price_paid numeric(12,2) not null check (price_paid >= 0 and price_paid < 'Infinity'::numeric),
  calorie_percentage numeric,
  protein_percentage numeric,
  overall_grade text check (overall_grade in ('A','B','C','D','E')),
  check ((product_barcode is null) <> (generic_product_id is null))
);
create index shopping_trip_items_trip_idx on public.shopping_trip_items(shopping_trip_id);
alter table public.shopping_trips enable row level security;
alter table public.shopping_trip_items enable row level security;
revoke all on public.shopping_trips, public.shopping_trip_items from public, anon, authenticated;
revoke all on sequence public.shopping_trip_items_id_seq from public, anon, authenticated;
grant select on public.shopping_trips, public.shopping_trip_items to authenticated;
create policy "Read own shopping trips" on public.shopping_trips for select to authenticated
using (user_id = (select auth.uid()));
create policy "Read own shopping items" on public.shopping_trip_items for select to authenticated
using (exists (select 1 from public.shopping_trips t where t.id = shopping_trip_id and t.user_id = (select auth.uid())));

create or replace function public.complete_shopping(p_trip_id uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
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
      case when v_score is null then null when v_score>=100 then 'A' when v_score>=75 then 'B'
        when v_score>=50 then 'C' when v_score>=25 then 'D' else 'E' end);
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
revoke all on function public.complete_shopping(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_shopping(uuid,jsonb) to authenticated;
commit;
