-- Run after 20260918_shopping.sql. No columns are added or data deleted by setup.
begin;
create or replace function public.delete_shopping_trip(p_trip_id uuid, p_remove_from_pantry boolean default false)
returns table(trip_deleted boolean, pantry_items_updated integer, pantry_items_unavailable integer, pantry_items_short integer)
language plpgsql security definer set search_path = pg_catalog
as $$
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
revoke all on function public.delete_shopping_trip(uuid,boolean) from public,anon,authenticated;
grant execute on function public.delete_shopping_trip(uuid,boolean) to authenticated;
commit;
