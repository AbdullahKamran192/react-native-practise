-- Run after 20260913_meal_images.sql. Preserve meals and their current paths.
-- Existing queued R2 objects are not deleted by this SQL; review them manually
-- in R2 if needed before discarding the queue. Disable the old Cron job first.
begin;
drop trigger if exists queue_old_meal_image on public.meals;
drop trigger if exists guard_meal_image on public.meals;
drop function if exists public.queue_old_meal_image();
drop function if exists public.guard_meal_image();
drop function if exists public.finish_meal_image(bigint,uuid,text,text);
drop function if exists public.claim_meal_image_cleanup(text);
drop table if exists public.meal_image_cleanup;
comment on column public.meals.image_path is
 'Private R2 key: meals/{user_id}/{meal_id}/image.webp. Legacy paths remain readable until replaced or removed.';
commit;
