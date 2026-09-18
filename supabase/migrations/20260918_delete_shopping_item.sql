-- Run after 20260918_shopping.sql. Running this migration removes no data.
begin;
create or replace function public.delete_shopping_item(p_trip_id uuid, p_item_id bigint)
returns integer language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then raise exception 'Sign in to delete a purchase.' using errcode='42501'; end if;
  -- Serialise item removals and whole-trip deletion by locking their parent.
  perform 1 from public.shopping_trips where id=p_trip_id and user_id=v_user for update;
  if not found then return 0; end if;
  delete from public.shopping_trip_items where id=p_item_id and shopping_trip_id=p_trip_id;
  get diagnostics v_count=row_count;
  if v_count=0 then return 0; end if;
  if exists(select 1 from public.shopping_trip_items where shopping_trip_id=p_trip_id) then
    update public.shopping_trips set total_spent=(select sum(price_paid) from public.shopping_trip_items where shopping_trip_id=p_trip_id)
      where id=p_trip_id;
  else
    delete from public.shopping_trips where id=p_trip_id;
  end if;
  return v_count;
end;
$$;
revoke all on function public.delete_shopping_item(uuid,bigint) from public,anon,authenticated;
grant execute on function public.delete_shopping_item(uuid,bigint) to authenticated;
commit;
