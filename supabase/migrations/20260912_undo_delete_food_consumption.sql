-- Undo the consumption-deletion feature. Run in FoodWorth's SQL Editor.
-- Keeps every consumption row and leaves pantry stock unchanged.
-- Previously hidden entries will appear in history again.
begin;

drop function if exists public.delete_food_consumption(uuid);

alter table public.food_consumption
  drop column if exists deleted_at;

commit;
