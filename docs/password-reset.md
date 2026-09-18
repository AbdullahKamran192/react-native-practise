# Forgotten passwords

Sign in → Forgot password? → enter email → open the email link → enter and
confirm a new password. Supabase Auth handles email delivery and password storage.
There are no SQL migrations or Edge Functions for this feature.

## Supabase setup

In Authentication → URL Configuration → Redirect URLs, allow:

- `myapp://reset-password` for installed iOS/Android builds (the existing app scheme).
- `http://localhost:8081/reset-password` for local web testing, adjusting the port if needed.
- `https://YOUR-WEB-DOMAIN/reset-password` when web is deployed.

In Authentication → Email Templates → Reset Password, use this link:

```html
<h2>Reset your FoodWorth password</h2>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a></p>
<p>If you did not request this, you can ignore this email.</p>
```

The app verifies the one-time hash when the user submits the new password.
This works without keeping a browser/device-specific PKCE verifier and avoids
email scanners consuming the token merely by fetching the link. The standard
Supabase confirmation URL's recovery access/refresh-token fragment is also supported.
Do not log or share reset URLs: they contain temporary credentials.

Use an installed development/production build for reliable native email links.
Expo Go uses a development-server `exp://.../--/reset-password` address instead:
that exact redirect must be allowed, the server must be reachable, and the link
must be opened on that device. Local web testing is simpler while using Expo Go.
Open native reset links on a device with the app installed.

For delivery to real users, configure Supabase custom SMTP. Its default mail
service restricts recipients and has low rate limits. The screen shows service
errors and otherwise gives the same check-your-email message whether or not an
account exists.

The recovery screen remains registered regardless of sign-in state so acquiring
the recovery session does not redirect away from the password form. Invalid or
expired links offer a new request. Passwords must match and be at least eight
characters; Supabase enforces any stronger password rules configured there.
After success, the app clears its query cache and signs out locally so the user
can sign in with the new password. This is not a promise to instantly revoke
every access token already issued on other devices.

## Test after setup

1. Request a link for a test account from the signed-out app.
2. Test opening the email with the app closed and already open.
3. Confirm mismatched passwords are rejected; then save a matching password.
4. Sign in with the new password and verify the old password fails.
5. Check an expired/used link and test the web flow separately.

Automated tests: `node tests/passwordRecovery.test.cjs`.

References:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/native-mobile-deep-linking
