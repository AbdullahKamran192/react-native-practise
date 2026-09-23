-- Optional recipe wording; matching and nutrition still use the linked product.
begin;
alter table public.public_meal_ingredients
  add column name text
  constraint public_meal_ingredients_name_check
  check (name is null or btrim(name) <> '');
comment on column public.public_meal_ingredients.name is
  'Optional recipe ingredient label, e.g. Frozen mangoes. NULL displays the generic product name. Does not affect pantry matching.';
commit;
