-- Step 1: consumption storage only. Run once in FoodWorth's SQL Editor.
-- Logging and optional pantry deductions will use a separate RPC next.
begin;

create table public.food_consumption (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  consumed_on date not null,
  -- Supply one UUID per eating event; reuse it for all meal ingredients.
  consumption_group_id uuid not null,
  meal_id bigint references public.meals(id) on delete set null,
  meal_name_snapshot text,
  product_barcode text references public.products(barcode_number) on delete restrict,
  generic_product_id bigint references public.generic_products(id) on delete restrict,
  product_name_snapshot text not null,
  brand_snapshot text,
  amount_consumed numeric(12,3) not null,
  measurement_unit text not null,
  -- Totals for amount_consumed, not per-100 values. NULL means unknown.
  calories_consumed numeric(18,6),
  protein_consumed numeric(18,6),
  carbs_consumed numeric(18,6),
  fat_consumed numeric(18,6),
  sugars_consumed numeric(18,6),
  salt_consumed numeric(18,6),
  fibre_consumed numeric(18,6),
  created_at timestamptz not null default now(),

  constraint food_consumption_one_product check (
    (product_barcode is not null) <> (generic_product_id is not null)
  ),
  constraint food_consumption_positive_amount check (
    amount_consumed > 0 and amount_consumed < 'Infinity'::numeric
  ),
  constraint food_consumption_unit check (measurement_unit in ('g', 'ml')),
  constraint food_consumption_product_name check (length(btrim(product_name_snapshot)) > 0),
  constraint food_consumption_meal_name check (
    meal_name_snapshot is null or length(btrim(meal_name_snapshot)) > 0
  ),
  -- A deleted meal keeps its snapshot even when meal_id becomes NULL.
  constraint food_consumption_meal_snapshot check (
    meal_id is null or meal_name_snapshot is not null
  ),
  constraint food_consumption_finite_date check (isfinite(consumed_on)),
  constraint food_consumption_calories check (calories_consumed >= 0 and calories_consumed < 'Infinity'::numeric),
  constraint food_consumption_protein check (protein_consumed >= 0 and protein_consumed < 'Infinity'::numeric),
  constraint food_consumption_carbs check (carbs_consumed >= 0 and carbs_consumed < 'Infinity'::numeric),
  constraint food_consumption_fat check (fat_consumed >= 0 and fat_consumed < 'Infinity'::numeric),
  constraint food_consumption_sugars check (sugars_consumed >= 0 and sugars_consumed < 'Infinity'::numeric),
  constraint food_consumption_salt check (salt_consumed >= 0 and salt_consumed < 'Infinity'::numeric),
  constraint food_consumption_fibre check (fibre_consumed >= 0 and fibre_consumed < 'Infinity'::numeric)
);

create index food_consumption_user_date_idx
  on public.food_consumption(user_id, consumed_on);
create index food_consumption_user_group_idx
  on public.food_consumption(user_id, consumption_group_id);
-- Support checks/updates when referenced catalogue entries or meals are deleted.
create index food_consumption_meal_idx
  on public.food_consumption(meal_id) where meal_id is not null;
create index food_consumption_barcode_idx
  on public.food_consumption(product_barcode) where product_barcode is not null;
create index food_consumption_generic_idx
  on public.food_consumption(generic_product_id) where generic_product_id is not null;

alter table public.food_consumption enable row level security;
revoke all on public.food_consumption from public, anon, authenticated;
revoke all on sequence public.food_consumption_id_seq from public, anon, authenticated;
grant select on public.food_consumption to authenticated;

create policy "Users read their own food consumption"
  on public.food_consumption for select to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.food_consumption is
  'One snapshot row per consumed product or meal ingredient. Client writes must go through the planned logging RPC.';
comment on column public.food_consumption.consumption_group_id is
  'Shared UUID for one eating event. Grouping only; not by itself a uniqueness or retry guarantee.';

commit;

