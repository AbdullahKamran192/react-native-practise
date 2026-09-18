# Account deletion

Settings → Delete account opens a confirmation dialog on iOS, Android and web.
The user types DELETE and confirms. Only the authenticated user's account can
be deleted; the backend never accepts a target user ID.

## Setup

1. Run `supabase/migrations/20260917_account_deletion.sql` in Supabase SQL Editor.
   It installs a deletion trigger; running it does not delete any accounts.
2. Deploy from `my-app`:

   ```sh
   npx supabase functions deploy delete-account --project-ref shcmhmrjfkcvpplxnrfa --no-verify-jwt
   ```

The function verifies the bearer token using Supabase Auth. It uses the existing
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY secrets and Supabase's
server service-role key. The R2 token needs list and delete access to
`foodworth-private-images`. No client secrets, new columns or scheduled jobs.

## Data removed

- Auth account (hard deletion, including admin accounts).
- Pantry, food consumption, meals and meal items, user settings.
- Product corrections, user image moderation and admin membership.
- Reviewer references to that account on other users' corrections become NULL.
- Private R2 objects under `meals/{user_id}/` and `product-corrections/{user_id}/`,
  including legacy filenames and abandoned uploads.
- Local pending consumption retries and the current app's query cache; the app signs out.

Shared products/generic products and approved public product photos stay in the
catalogue. They are not personal pantry records; the deleted user's correction
and reviewer links are removed. This retention is disclosed in the dialog.

The SQL trigger explicitly deletes dependent rows before Auth deletion so it
also works with older non-cascading foreign keys. Its trusted transaction context
allows removal of pending corrections through the existing image-review guard.
Any database error rolls back database deletion. It gives clients no permission
to delete Auth records directly.

R2 and PostgreSQL cannot share a transaction. Private photos are removed first;
a failure leaves the account for retry, and some photos may already be gone.
Uploads already running on another device should be stopped before deletion;
there is no background cleanup job for concurrent in-flight uploads. Deleting a
user directly in Supabase Dashboard invokes database cleanup, but does not call
R2 cleanup: use the app flow for full private-photo removal.

## Policy and release follow-up

The app's Privacy Policy and Terms screens are currently placeholders. Publish
the real policy describing deletion, retained shared catalogue content, and
any provider backup retention before release. This implementation is not a
complete compliance certification.

Apple requires an in-app account deletion option:
https://developer.apple.com/support/offering-account-deletion-in-your-app/

Google Play also requires an outside-the-app deletion request web link in the
store listing; that website is not implemented here:
https://support.google.com/googleplay/android-developer/answer/13327111

Google/Apple login buttons are now implemented. Before releasing Apple login,
implement Apple token revocation as part of deletion; the current deletion
endpoint removes the Supabase account but does not revoke Apple authorisation.
See `social-sign-in.md` for provider configuration and this release dependency.

## Verification

Use a disposable account with a pantry item, consumption entry, meal photo and
pending product photo. Confirm cancelling makes no changes, confirming deletes
its records/private objects, other users remain intact, and a new sign-in with
the deleted credentials fails. Do not test with the only real admin account.

Automated coverage: `tests/accountDeletion.endpoint.test.cjs` and
`tests/accountDeletion.sql.test.cjs` (PGlite via FOODWORTH_PGLITE_PATH).
