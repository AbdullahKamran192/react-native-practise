-- Run once in Supabase SQL Editor after 20260913_product_image_reviews.sql.
-- Allow replacement submissions; no new columns, tables or storage changes.
begin;
create or replace function public.begin_product_image_action(p_actor uuid,p_user uuid,p_barcode text,p_action text,p_submitted timestamptz default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c public.product_corrections; ticket timestamptz := clock_timestamp();
begin
 if p_action not in ('upload','approve','reject') then raise exception 'Invalid action'; end if;
 if p_action='upload' then
  if p_actor<>p_user then raise exception 'Not authorised'; end if;
  if exists(select 1 from public.user_image_moderation where user_id=p_user and (image_upload_blocked or violation_count>=3)) then
   raise exception 'Product photo uploads are blocked for this account.';
  end if;
 else
  if not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Not authorised'; end if;
 end if;
 perform 1 from public.products where barcode_number=p_barcode for update;
 if not found then raise exception 'Save the product information first.'; end if;
 if exists(select 1 from public.product_corrections where product_barcode=p_barcode
   and image_reviewed_by is not null and (image_status='pending' or image_submitted_at is null)) then
  raise exception 'A photo operation is already in progress. Try again shortly.';
 end if;
 select * into c from public.product_corrections where user_id=p_user and product_barcode=p_barcode for update;
 if not found then raise exception 'Save the product correction first.'; end if;
 if p_action='upload' then
  if c.image_status='pending' then raise exception 'Your photo is already awaiting review.'; end if;
  -- Existing shared/OFF images may be replaced after administrator review.
 else
  if c.image_status is distinct from 'pending' or c.image_path is null or c.image_submitted_at is distinct from p_submitted then
   raise exception 'This submission has changed or was already reviewed.';
  end if;
 end if;
 update public.product_corrections set image_reviewed_by=p_actor,image_reviewed_at=ticket,
   image_status=case when p_action='upload' then 'pending' else image_status end
 where user_id=p_user and product_barcode=p_barcode;
 return jsonb_build_object('ticket',ticket,'previous',to_jsonb(c));
end; $$;
revoke all on function public.begin_product_image_action(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.begin_product_image_action(uuid,uuid,text,text,timestamptz) to service_role;
commit;
