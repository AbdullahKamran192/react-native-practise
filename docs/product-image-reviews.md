# Barcode product image reviews

This feature adds one admin review page and optional photo submissions on the
barcode product screens (Add to Pantry, Consume Food and Add ingredient).
Generic-product images, meal photos and numerical correction calculations are
unchanged. There are no queues, Cron jobs, voting, analytics or AI moderation.

## Manual setup

1. Run `supabase/migrations/20260913_product_image_reviews.sql` in Supabase SQL
   Editor. Do not rerun the old image migrations. This creates:
   - `admin_users` (user_id, created_at), readable only for one's own membership.
   - `user_image_moderation`, writable only by the backend.
   - `products.image_path` for an approved public image.
   - Correction fields `image_path`, `image_status`, `image_rejection_reason`,
     `image_submitted_at`, `image_reviewed_at`, `image_reviewed_by`.
   - Guards and backend-only functions for submission/review decisions and strikes.

   `image_submitted_at` supplies the submission date on the review card and
   identifies the specific submission being reviewed. Existing `image_url`
   columns remain the Open Food Facts fallback. Private images never enter them.
2. Add your administrator account manually, using its Supabase Auth UUID:

   ```sql
   insert into public.admin_users (user_id)
   values ('YOUR_AUTH_USER_UUID');
   ```

   Do not use an email address or the project/account ID. Ordinary users need no
   membership row and cannot insert/update/delete admin membership themselves.
3. Configure R2 secrets in Supabase Edge Function Secrets:
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
   The token now needs Object Read & Write access to **both**
   `foodworth-private-images` and `foodworth-public-images`. Existing meal-photo
   credentials may only allow the private bucket, so replace that token if needed.
   Keep the private bucket private. The public bucket uses the existing configured
   public R2 URL. No new client secrets or moderation secrets are required.
4. Deploy only the new function from `my-app`:

   ```sh
   npx supabase functions deploy product-images --project-ref YOUR_PROJECT_REF --no-verify-jwt
   ```

   `verify_jwt=false` delegates authentication to the function's `auth.getUser()`
   check. Every admin action also checks `admin_users`. No UUID is assigned by
   this deployment. Restart the updated app after applying the SQL/deployment.

No migration, deployment, token change or administrator assignment is performed
automatically by this implementation.

## User flow

The optional picker appears when the product has neither a shared image nor an
Open Food Facts image, and the user's product uploads are not blocked. Existing
pending/rejected status remains visible even if a shared image becomes available.

Choose/take a photo, preview it, then press **Submit photo for review**. This saves
the displayed product correction first and submits the photo separately; it does
not add pantry stock or log consumption. Compression and validation reuse the
meal-photo helper (WebP, longest side at most 1200 pixels, quality 75%, 2 MiB cap).
The backend independently validates the file signature/size. Its database function
checks correction ownership, upload blocking, pending submissions and existing
shared images in `products.image_path` / `products.image_url`. Uploads never contact
Open Food Facts; a missing OFF product or an OFF outage cannot block submission.
The normal product lookup on the app's product screens remains unchanged.

Private object: `product-corrections/{user_id}/{barcode}/image.webp`.
There is no correction ID because corrections use user_id + barcode as their key.
One pending photo per user/barcode is allowed; it cannot be replaced while waiting.
Only the uploader and administrators receive temporary URLs for that private image.
Pending images are shown on the uploader's product screen with **Awaiting review**.
Other catalogue/list views use the shared approved image, OFF fallback or placeholder.

## Admin flow

Settings shows **Product image reviews** only to an administrator. Direct navigation
by a non-admin shows Not authorised and returns to Settings. Backend enforcement
is independent of that visibility check.

The page fetches up to 20 pending cards, the total pending count, name, barcode,
submission date and private preview. It refreshes after every review to show the
next submissions. **Reject** opens a required reason selection:
wrong_product, poor_quality, duplicate, personal_information, offensive, abusive,
or other. Only offensive and abusive produce a strike; the modal explains this.

**Approve** uploads the submitted bytes to `products/{barcode}/image.webp`, deletes
the private copy, then atomically marks the correction approved and sets the shared
product path. Other pending submissions are not automatically accepted/rejected.
Approving another card for that barcode intentionally replaces the public image.
**Reject** deletes the private copy, clears its path, records the reviewer/time and
reason, and increments a strike only for offensive/abusive. Three strikes block only
future product-photo submissions. Pantry, meals, logging and numerical edits remain
available. The uploader sees a rejection reason, never the rejected photograph.

Admin endpoints: admin-status, list-pending, approve, reject.
User endpoints: own-status, upload. All require a valid signed-in user.

## Failure handling and limits

The backend reserves one action per barcode before R2 work using the existing
reviewer/time fields while status is pending. This prevents duplicate reviews and
strikes or overwriting a photo during review. It releases the reservation after a
handled failure, with synchronous restoration of a deleted private photo if needed.
Only completed reviews appear as approved/rejected. No job/queue runs in the background.

Failed uploads release their database reservation even if the R2 cleanup request
also fails. The release is conditional on the same reservation still being active;
a successful database commit whose response was lost is preserved. If the database
itself is unavailable, recovery can still require manual intervention. An ambiguous
R2 upload followed by failed cleanup may leave an unlinked private object.

For existing empty stuck submissions, run
`supabase/migrations/20260913_repair_stuck_product_images.sql` manually as postgres
after stopping photo operations and confirming the objects are absent in R2.
It resets only image metadata for pending rows with no path/submission date and a
reservation older than 15 minutes. Product names and numerical corrections are preserved.

`product-images` logs structured operation/bucket/status/error-code/message entries
for R2 failures and database rollback failures. It never logs SDK objects, credentials,
authorization headers or signed URLs. `SignGetObject` only creates a URL locally;
its success does not prove that R2 will accept the credentials when the app uses it.
Both image functions use endpoint `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
region `auto`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. Both use
`foodworth-private-images`; product approval additionally uses
`foodworth-public-images`. Changing those shared secrets affects meal photos too.

A process crash or an unavailable database during recovery can require manual
intervention. In particular, a pending row with image_reviewed_by set indicates an
interrupted/in-progress operation; wait for the request to finish, inspect R2 and
review the Edge Function logs before repairing that row in Supabase. Do not clear
reservations while requests are still active. R2 and PostgreSQL cannot commit in
one transaction, so publication can succeed before a later database operation fails.
Account deletion/direct SQL correction deletion does not automatically remove R2
files. Those cases remain manual rather than adding scheduled cleanup.

Public approved images use no-store and disable the app's disk cache. Private
previews use no-store, no app disk cache and five-minute signed URLs; the uploader's
status refreshes while open and on focus. Anyone with an issued signed URL may use
it until expiry, unless the underlying object has been deleted.

## Validation

`node --test tests/productImages.endpoint.test.cjs` checks that uploads succeed
without external lookup access, retain file validation and respect database denials.

`tests/productImageReviews.sql.test.cjs` checks RLS/admin isolation, guarded metadata,
numerical edits, duplicate operations, approval, rejection reasons and strike limits
using isolated PGlite PostgreSQL. The Edge Function is type-checked with Deno and
the app with TypeScript/Expo web export.

After setup, test with an admin and two ordinary accounts: missing-image submission,
private uploader preview, non-admin review rejection, approval shown to both users,
rejection/removal, three offensive strikes, a normal rejection without a strike,
and unchanged meal/generic/numerical correction behavior. Live R2 integration and
physical-device checks require your deployed function and credentials.
