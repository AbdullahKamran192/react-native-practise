# Google and Apple sign-in

Sign-in and sign-up both offer Continue with Google / Apple. Supabase OAuth
creates or signs in the Auth user. Mobile opens the system browser auth sheet;
web navigates to the provider and returns to `/auth-callback`. The provider
controls consent prompts and may skip them for previously authorised users.
No SQL migrations, new dependencies or app-side provider secrets.

## Required dashboard setup

1. Supabase → Authentication → Sign In / Providers: enable the providers and
   enter their client credentials there (never in EXPO_PUBLIC variables).
2. Supabase → Authentication → URL Configuration → Redirect URLs: allow
   `myapp://auth-callback`, plus your exact web callback, such as
   `http://localhost:8081/auth-callback` or `https://your-domain/auth-callback`.
   This is separate from the password reset redirect.
3. In Google Cloud configure an OAuth consent screen and Web application OAuth
   client. Add Supabase's callback as an authorised redirect URI:
   `https://shcmhmrjfkcvpplxnrfa.supabase.co/auth/v1/callback`.
   Copy that client's ID/secret into the Supabase Google provider. While Google
   consent is in testing, add your test users.
4. In Apple Developer configure a Sign in with Apple App ID, associated Services
   ID, website domain and the same Supabase HTTPS return URL. Configure the
   Services ID and generated client-secret JWT in Supabase's Apple provider.
   Apple Developer membership and signing-key setup are required. OAuth client
   secrets expire: renew them before expiry (maximum six months).

Use an installed development/production build for native OAuth testing. Expo Go
is not a reliable provider-login test environment; custom app schemes require a
build. Web can be tested independently with the exact redirect allowed above.

Provider callbacks go first to Supabase's HTTPS URL, then to the app redirect.
Do not confuse these two URL settings. Keep the client's existing implicit flow
and manual URL-session handling; password recovery has its own route.

Apple can hide the email address; its browser OAuth flow does not reliably
provide a full name. The existing profile falls back to email/display defaults.
Buttons use the shared `googleIcon` / `appleIcon` asset entries. Check current
provider branding requirements before publishing.

## Account deletion follow-up before Apple release

The existing deletion endpoint removes the FoodWorth/Supabase account but does
not revoke Apple's provider tokens. Apple token revocation must be integrated
with deletion before shipping Sign in with Apple. This needs server-side Apple
credential/token handling; do not assume deleting an Auth user revokes Apple
authorisation. This change adds the login flow only.

## Validation

`node tests/socialAuth.test.cjs` covers both providers, cancellation, disabled
providers, repeated callbacks, web redirect and invalid/recovery URLs. After
configuration, test first login, returning login, consent cancellation, private
relay email and callbacks on an installed iOS/Android build and web.

References:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/social-login/auth-apple
- https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- https://developer.apple.com/support/offering-account-deletion-in-your-app/
