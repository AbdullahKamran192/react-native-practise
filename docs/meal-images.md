# Private meal photos

One optional image per meal, stored at:
`meals/{user_id}/{meal_id}/image.webp` in `foodworth-private-images`.
Replacement overwrites this same object. No UUID filenames, cleanup queue,
cleanup endpoint, scheduled job or extra cleanup secret are used.

## Update your existing setup

1. Disable/delete the old meal-image cleanup Cron job if you created it.
2. Run `supabase/migrations/20260913_simplify_meal_images.sql` in Supabase SQL Editor.
   The original `20260913_meal_images.sql` has already run; do not rerun it.
   The new migration removes its queue, triggers and helper functions while
   preserving `meals.image_path`, existing meals and existing image references.
   If you need to manually remove previously queued R2 objects, inspect/export
   those queue paths before running the migration: dropping the queue does not
   remove its R2 objects.
3. Remove `MEAL_IMAGE_CLEANUP_SECRET` from Edge Function Secrets if you added it.
   Keep only these three R2 settings:

   | Secret | Value |
   | --- | --- |
   | `R2_ACCOUNT_ID` | Cloudflare account ID |
   | `R2_ACCESS_KEY_ID` | R2 Object Read & Write token Access Key ID |
   | `R2_SECRET_ACCESS_KEY` | That token's Secret Access Key |

   Scope the token to `foodworth-private-images`. Keep this bucket private.
   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically.
   Never store server secrets in Expo environment variables or commit them.
4. Redeploy the updated function from `my-app`:

   ```sh
   npx supabase login
   npx supabase functions deploy meal-images --project-ref YOUR_PROJECT_REF --no-verify-jwt
   ```

   The function verifies every request with `auth.getUser(token)` and checks
   meal ownership itself; this is why gateway `verify_jwt` is disabled.
5. Restart Expo. Custom native builds need the photo picker, manipulator and
   file-system packages already added to the project, so rebuild if necessary.

For a fresh database, apply both meal-image migrations in chronological order.
Deploy this backend and updated app together after applying the new migration.

## How it works

Choose/take an optional photo on Create meal, or add/change it later on Meal details.
Create meal saves the meal first and then uploads the selected photo using its ID.
If that upload fails, retry it or continue to the saved meal without creating a duplicate.
The app previews a WebP
image compressed to 75% quality with longest side at most 1200 pixels. Both app
and backend enforce a 2 MiB limit. The backend validates WebP file signatures.

- Upload/replace: verify ownership, upload to the fixed path, then save that path
  on the meal. Previously saved UUID photos are readable until replacement;
  replacement deletes that old object before uploading the fixed-path photo.
- View: verify ownership and return a signed GET URL valid for 15 minutes.
  Every URL has a distinct signed response parameter; responses use no-store.
  The app disables image caching, remounts the image when its URL changes and
  refreshes viewing URLs every 10 minutes while mounted.
- Remove photo: delete its R2 object, then set `image_path` to NULL.
- Delete meal: the app now calls the Edge Function, which deletes the R2 object
  first, then deletes the meal row. Existing ingredient cascade behavior remains.

An R2 deletion failure returns an error without updating/deleting the database
record. R2 and PostgreSQL are separate operations: if R2 succeeds but the database
fails, the row can still reference a removed photo; retry the operation. Interrupted
uploads or concurrent requests can leave unused objects. There is no automated
retry or orphan cleanup in this simpler version. Direct SQL/account-cascade meal
removal does not delete R2 objects; use the app flow or remove those manually.

The public bucket, barcode/generic product images and consumption history are
unchanged. Uploads pass through the Edge Function, so R2 upload CORS is unnecessary.

## Checks

The SQL test applies the original migration and then the simplification, verifying
that meal/image data survives and cleanup objects are removed. The Edge Function
is checked separately with Deno; Expo TypeScript excludes `supabase/functions`.

After deployment, verify upload, replacement, immediate display refresh, removal,
meal deletion and rejection of another user's meal ID. Live R2 testing requires
configured secrets and a deployed function.
