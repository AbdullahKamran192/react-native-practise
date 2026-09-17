-- Run in FoodWorth's Supabase SQL Editor.
-- Permit the app's direct DELETE of a signed-in user's own pantry entries.
-- Existing SELECT/INSERT/UPDATE policies remain unchanged.
-- This migration does not delete rows or add columns/tables.
begin;

alter table public.pantry enable row level security;
grant delete on table public.pantry to authenticated;

drop policy if exists "FoodWorth users delete their own pantry entries" on public.pantry;
create policy "FoodWorth users delete their own pantry entries"
  on public.pantry
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
