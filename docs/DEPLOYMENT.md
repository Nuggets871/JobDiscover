# Deployment and activation

The preview is owner-only and runs in demo mode until the external services are configured. Do not open public registration before the checks below are completed. No paid service has been purchased.

## 1. Managed accounts and database

Create a Supabase project in an appropriate EU region. Apply `web/supabase/migrations/001_private_accounts.sql`, `002_offer_cache.sql`, and `003_job_enrichment.sql` in order using the SQL editor or a migration tool. They contain schema only, never user data. Choose and document a backup plan and retention period, then test restoration in a separate project.

Set the following server-side runtime variables via Sites secrets (and `.env.local` for development):

- `APP_ORIGIN`: exact HTTPS application origin in production, `http://localhost:3000` locally. No trailing slash needed.
- `SUPABASE_URL`: the HTTPS project URL.
- `SUPABASE_PUBLISHABLE_KEY`: the project publishable key.
- `SUPABASE_SECRET_KEY`: the server secret key. A legacy service-role JWT is also supported. Never prefix a privileged variable with `NEXT_PUBLIC_` or `VITE_`.

Auth configuration:

- Enable email/password signup and email confirmation. Enforce passwords of at least 12 characters and compromised-password checks where available.
- Set Site URL to `APP_ORIGIN`. Configure production SMTP, provider rate limits, allowed callback URLs, session expiry and signup abuse controls before public registration. Test delivery with disposable accounts.
- Confirmation email link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
- Recovery email link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
- The confirmation page strips the token from the address bar and requires a button press so mail scanners do not consume the link. Auth URLs should be redacted from hosting access logs; disable request URL/body logging for auth endpoints where available.
- Sessions are stored in host-only HttpOnly cookies, Secure on HTTPS, with SameSite=Lax. API writes require exact Origin matching. Do not enable wildcard CORS.
- User data operations use the user's verified access token, not the privileged key. RLS protects direct database API access too.

Real-service acceptance: create two disposable accounts; confirm emails; log in/out; reset a password; save and restore a draft/profile; save, change and undo feedback; export; attempt cross-account access; delete a disposable account. Repeat relevant isolation tests on staging with the actual managed Auth stack. Local SQL tests are not a replacement for this check.

## 2. France Travail

Create an application at https://francetravail.io/produits-partages/catalogue/offres-emploi and obtain access to Offres d'emploi v2 under its current reuse terms. Configure `FRANCE_TRAVAIL_CLIENT_ID` and `FRANCE_TRAVAIL_CLIENT_SECRET` as secrets. The adapter requests `api_offresdemploiv2 o2dsoffre` scopes using the partner OAuth endpoint.

Validate the adapter against actual credentials: OAuth access, a geographic search, pagination, source links, a current detail, an expired offer and provider throttling. Source descriptions are treated as untrusted plain text. Search includes no narrow job-title filter so the recommender retains discovery candidates. We intentionally retrieve only up to 300 recent results per query, with a 15-minute shared cache; additional coverage needs a later ingestion strategy.

## 3. Optional DeepSeek

Set `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL` (default `deepseek-chat`). Set `AI_PUBLIC_JOB_ENRICHMENT=true` only after reviewing the provider's processing terms for public descriptions. This is disabled by default, including with a key present.

The model only receives a title and public-duty excerpt with detectable contacts removed, never user profile, location or feedback. Automatic text redaction cannot guarantee that every name is removed from public free text. It is not appropriate for CVs or private documents. The enrichment is used on offer detail, is cached by model/content hash, is capped at 30 calls/hour and 150/day and falls back to the original content. Set provider-side budget limits too. Recommendations are available without it.

## 4. Maintenance and private preview

Set a random `CRON_SECRET` of at least 32 characters as a runtime secret. The protected POST `/api/maintenance` deletes expired shared caches and quota rows. To enable the checked-in daily GitHub workflow, configure repository variable `MAINTENANCE_ENABLED=true`, variable `APP_ORIGIN` and secret `CRON_SECRET`. An owner-only Sites preview will not accept anonymous cron calls through its access gate; enable a suitable scheduler when the runtime is accessible or configure an approved dispatch path. The workflow is disabled by default. Query freshness works without the cleanup job; retention cleanup requires it.

Publish only the validated Worker build using Sites. Keep the preview private until external integration tests and privacy notice are complete. `.openai/hosting.json` contains only the project identifier and logical bindings, never secrets. The public-account app uses Supabase auth; Sites ChatGPT auth is only an outer access gate for the private preview and is not used as the app account identity.

## 5. Required before public opening

Complete the user-facing privacy notice with operator identity and contact, lawful bases, processor terms, storage regions/transfers, data rights and actual retention/backup periods. Set response and operational logging policies so tokens, passwords, emails and preference payloads are not recorded. Configure monitoring of error/status counts without user content. Review provider quotas and signup abuse protection. Verify backup restoration and rollback to the preceding Sites version. Do not claim end-to-end encryption or zero risk.

Review the original Git author metadata before making the existing repository public. The app's new commits use a technical identity. No existing history was rewritten.
