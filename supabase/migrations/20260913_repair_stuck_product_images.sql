-- One-time repair: run manually in Supabase SQL Editor as postgres.
-- Stop photo submissions/reviews first and confirm these uploads have no R2 object.
-- Includes the reported barcode 8901808003021 and other rows with the same shape.
-- The 15-minute age guard avoids resetting a recently started upload.
begin;
-- Allow the existing backend-only image-field trigger in this transaction only.
set local request.jwt.claim.role = 'service_role';
set local request.jwt.claims = '{"role":"service_role"}';

update public.product_corrections
set image_status = null,
    image_rejection_reason = null,
    image_reviewed_at = null,
    image_reviewed_by = null
where image_status = 'pending'
  and image_path is null
  and image_submitted_at is null
  and image_reviewed_by is not null
  and image_reviewed_at < now() - interval '15 minutes'
returning user_id, product_barcode, image_status;

commit;
