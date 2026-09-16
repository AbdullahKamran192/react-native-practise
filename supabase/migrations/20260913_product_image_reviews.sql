-- Barcode image moderation only. Run manually after existing image migrations.
begin;
create table public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public,anon,authenticated;
grant select on public.admin_users to authenticated;
grant all on public.admin_users to service_role;
create policy "Read own admin membership" on public.admin_users for select to authenticated
 using (user_id=(select auth.uid()));
create table public.user_image_moderation (
 user_id uuid primary key references auth.users(id) on delete cascade,
 violation_count integer not null default 0 check(violation_count>=0),
 image_upload_blocked boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.user_image_moderation enable row level security;
revoke all on public.user_image_moderation from public,anon,authenticated;
grant all on public.user_image_moderation to service_role;

alter table public.products add column if not exists image_path text;
alter table public.product_corrections
 add column image_path text,
 add column image_status text check(image_status in ('pending','approved','rejected')),
 add column image_rejection_reason text check(image_rejection_reason in ('wrong_product','poor_quality','duplicate','personal_information','offensive','abusive','other')),
 add column image_submitted_at timestamptz,
 add column image_reviewed_at timestamptz,
 add column image_reviewed_by uuid references auth.users(id) on delete set null;
create index product_images_pending_idx on public.product_corrections(image_submitted_at)
 where image_status='pending';

-- Do not let ordinary correction writes publish arbitrary image URLs or modify
-- review metadata. Numerical edits still pass through existing aggregation.
create or replace function public.guard_product_image_review() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if coalesce(auth.role(),'') <> 'service_role' then
  if tg_op='DELETE' then
   if old.image_status='pending' or old.image_path is not null then
    raise exception 'A pending photo must be reviewed before removing its correction.' using errcode='42501';
   end if;
   return old;
  end if;
  if tg_op='INSERT' then
   if new.image_path is not null or new.image_status is not null or new.image_rejection_reason is not null
     or new.image_submitted_at is not null or new.image_reviewed_at is not null or new.image_reviewed_by is not null then
    raise exception 'Use the product image service.' using errcode='42501';
   end if;
  else
   if row(new.image_path,new.image_status,new.image_rejection_reason,new.image_submitted_at,new.image_reviewed_at,new.image_reviewed_by)
     is distinct from row(old.image_path,old.image_status,old.image_rejection_reason,old.image_submitted_at,old.image_reviewed_at,old.image_reviewed_by)
     or new.user_id is distinct from old.user_id or new.product_barcode is distinct from old.product_barcode then
    raise exception 'Image review fields are backend controlled.' using errcode='42501';
   end if;
  end if;
  if new.image_url is not null and (tg_op='INSERT' or new.image_url is distinct from old.image_url)
    and new.image_url !~ '^https://images\.openfoodfacts\.org/' then
   raise exception 'External image URLs must come from Open Food Facts.' using errcode='42501';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
create trigger guard_product_image_review before insert or update or delete on public.product_corrections
 for each row execute function public.guard_product_image_review();

-- Preserve the existing OFF fallback trigger, but never copy private/pending paths.
create or replace function public.fill_product_image_from_corrections() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.image_url is null then
  select c.image_url into new.image_url from public.product_corrections c
  where c.product_barcode=new.barcode_number and c.image_url ~ '^https://images\.openfoodfacts\.org/'
  order by c.user_id limit 1;
 end if;
 return new;
end; $$;

-- Reserve one action per barcode before touching R2. The reviewer/time fields
-- temporarily mark work in progress. Completed/released operations clear that
-- reservation; no jobs, queues or automatic retry workers are created.
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
  if exists(select 1 from public.products where barcode_number=p_barcode and (image_path is not null or nullif(image_url,'') is not null)) then
   raise exception 'This product already has an image.';
  end if;
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

create or replace function public.finish_product_image_action(p_actor uuid,p_user uuid,p_barcode text,p_action text,p_ticket timestamptz,p_reason text default null)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare c public.product_corrections;
begin
 if p_action not in ('upload','approve','reject') then raise exception 'Invalid action'; end if;
 if p_action<>'upload' and not exists(select 1 from public.admin_users where user_id=p_actor) then raise exception 'Not authorised'; end if;
 select * into c from public.product_corrections where user_id=p_user and product_barcode=p_barcode for update;
 if not found or c.image_status is distinct from 'pending' or c.image_reviewed_by is distinct from p_actor or c.image_reviewed_at is distinct from p_ticket then
  raise exception 'Photo operation no longer available.';
 end if;
 if p_action='upload' then
  if p_actor<>p_user then raise exception 'Not authorised'; end if;
  if exists(select 1 from public.user_image_moderation where user_id=p_user and (image_upload_blocked or violation_count>=3)) then
   raise exception 'Product photo uploads are blocked for this account.';
  end if;
  update public.product_corrections set image_path='product-corrections/'||p_user::text||'/'||p_barcode||'/image.webp',
   image_status='pending',image_submitted_at=clock_timestamp(),image_reviewed_by=null,image_reviewed_at=null,image_rejection_reason=null
   where user_id=p_user and product_barcode=p_barcode;
 elsif p_action='approve' then
  update public.products set image_path='products/'||p_barcode||'/image.webp' where barcode_number=p_barcode;
  update public.product_corrections set image_status='approved',image_path=null,image_rejection_reason=null,image_reviewed_at=clock_timestamp()
   where user_id=p_user and product_barcode=p_barcode;
 else
  if p_reason is null or p_reason not in ('wrong_product','poor_quality','duplicate','personal_information','offensive','abusive','other') then raise exception 'Choose a rejection reason.'; end if;
  update public.product_corrections set image_status='rejected',image_path=null,image_rejection_reason=p_reason,image_reviewed_at=clock_timestamp()
   where user_id=p_user and product_barcode=p_barcode;
  if p_reason in ('offensive','abusive') then
   insert into public.user_image_moderation(user_id,violation_count,image_upload_blocked) values(p_user,1,false)
   on conflict(user_id) do update set violation_count=public.user_image_moderation.violation_count+1,
    image_upload_blocked=public.user_image_moderation.image_upload_blocked or public.user_image_moderation.violation_count+1>=3,updated_at=now();
  end if;
 end if;
end; $$;
revoke all on function public.guard_product_image_review(),public.begin_product_image_action(uuid,uuid,text,text,timestamptz),
 public.finish_product_image_action(uuid,uuid,text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.begin_product_image_action(uuid,uuid,text,text,timestamptz),
 public.finish_product_image_action(uuid,uuid,text,text,timestamptz,text) to service_role;
commit;
