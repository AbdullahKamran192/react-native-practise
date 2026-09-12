-- Physically delete an owned consumption event. No columns or tables added.
begin;
create or replace function public.delete_food_consumption(p_group_id uuid)
returns integer language plpgsql security definer set search_path = pg_catalog
as $$
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
revoke all on function public.delete_food_consumption(uuid) from public, anon, authenticated;
grant execute on function public.delete_food_consumption(uuid) to authenticated;
commit;

