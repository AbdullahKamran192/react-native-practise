-- Private R2 meal photos. Run in Supabase SQL Editor.
begin;
alter table public.meals add column if not exists image_path text;
create table if not exists public.meal_image_cleanup (
  image_path text primary key,
  not_before timestamptz not null default now(),
  claimed boolean not null default false
);
alter table public.meal_image_cleanup enable row level security;
revoke all on public.meal_image_cleanup from public, anon, authenticated;
grant all on public.meal_image_cleanup to service_role;

create or replace function public.guard_meal_image() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if (tg_op = 'INSERT' and new.image_path is not null)
    or (tg_op = 'UPDATE' and new.image_path is distinct from old.image_path) then
    if coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'Use the meal photo service to change images.' using errcode = '42501';
    end if;
    if new.image_path is not null and new.image_path !~
      ('^meals/' || new.user_id::text || '/' || new.id::text || '/[0-9a-f-]{36}\.webp$') then
      raise exception 'Invalid meal image path.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists guard_meal_image on public.meals;
create trigger guard_meal_image before insert or update on public.meals
for each row execute function public.guard_meal_image();

create or replace function public.queue_old_meal_image() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if old.image_path is not null then
    if tg_op = 'DELETE' or old.image_path is distinct from new.image_path then
      insert into public.meal_image_cleanup(image_path) values(old.image_path)
      on conflict(image_path) do nothing;
    end if;
  end if;
  return null;
end; $$;
drop trigger if exists queue_old_meal_image on public.meals;
create trigger queue_old_meal_image after update or delete on public.meals
for each row execute function public.queue_old_meal_image();

-- Only the backend may publish an uploaded path. Lock its cleanup record so
-- cleanup cannot race with publication. A failed upload expires after one day.
create or replace function public.finish_meal_image(p_id bigint, p_user uuid, p_expected text, p_path text)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  if p_path is not null then
    perform 1 from public.meal_image_cleanup where image_path=p_path and not claimed for update;
    if not found then raise exception 'Upload expired. Choose the photo again.'; end if;
  end if;
  update public.meals set image_path=p_path
    where id=p_id and user_id=p_user and image_path is not distinct from p_expected;
  if not found then raise exception 'Meal changed. Refresh before changing its photo.'; end if;
  if p_path is not null then delete from public.meal_image_cleanup where image_path=p_path; end if;
end; $$;

create or replace function public.claim_meal_image_cleanup(p_path text)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform 1 from public.meal_image_cleanup where image_path=p_path and not_before <= now() for update;
  if not found then return false; end if;
  if exists(select 1 from public.meals where image_path=p_path) then
    delete from public.meal_image_cleanup where image_path=p_path;
    return false;
  end if;
  update public.meal_image_cleanup set claimed=true where image_path=p_path;
  return true;
end; $$;
revoke all on function public.guard_meal_image(), public.queue_old_meal_image(),
 public.finish_meal_image(bigint,uuid,text,text), public.claim_meal_image_cleanup(text) from public,anon,authenticated;
grant execute on function public.finish_meal_image(bigint,uuid,text,text), public.claim_meal_image_cleanup(text) to service_role;
comment on column public.meals.image_path is 'Private R2 object key, never a signed URL.';
commit;
