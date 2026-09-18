-- Run in Supabase SQL Editor before deploying delete-account.
-- No accounts are deleted by running this migration.
begin;
create or replace function public.remove_account_data() returns trigger
language plpgsql security definer set search_path = pg_catalog
as $$
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
revoke all on function public.remove_account_data() from public, anon, authenticated;
drop trigger if exists remove_account_data on auth.users;
create trigger remove_account_data before delete on auth.users
for each row execute function public.remove_account_data();
commit;
