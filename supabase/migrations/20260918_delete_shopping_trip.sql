-- Run after 20260918_shopping.sql. No rows are deleted by this migration.
begin;
grant delete on public.shopping_trips to authenticated;
drop policy if exists "Delete own shopping trips" on public.shopping_trips;
create policy "Delete own shopping trips" on public.shopping_trips
  for delete to authenticated using (user_id = (select auth.uid()));
-- The existing shopping_trip_items foreign key cascades deletion to the trip's items.
-- Pantry stock is not changed. No deleted-row tracking columns are added.
commit;
