# Deployment and activation

The preview is owner-only and runs in demo mode until the external services are configured. Do not open public registration before the checks below are completed. No paid service has been purchased.

## 1. PostgreSQL and account service

JobDiscover owns its account system. PostgreSQL stores users, password digests, hashed session tokens, profiles and feedback; no database credential or session token is exposed to browser JavaScript. Passwords use PBKDF2-SHA-256 with a unique random salt and 600,000 iterations. Confirmation and recovery tokens expire after one hour and can be used once. Refresh tokens rotate on every use.

For local development:

```sh
cd web
docker compose up -d --wait
cp .env.example .env.local
npm run db:migrate
npm run server
# In another terminal, copy BACKEND_URL and BACKEND_SHARED_SECRET to .dev.vars,
# then run npm run dev.
```

For production, deploy `web/server/index.ts` as a private Node.js 22 service behind HTTPS. Only its health endpoint is public; every API route requires `BACKEND_SHARED_SECRET`. Allow PostgreSQL network access only from this service. Provision PostgreSQL in an EU region with encrypted storage, TLS, daily backups and point-in-time recovery. Run migrations from a restricted deployment job, then give the runtime database role only `SELECT`, `INSERT`, `UPDATE`, `DELETE` and permission to execute `consume_rate_limit`. It must not be able to create or drop schemas.

Configure the Sites frontend with:

- `BACKEND_URL`: HTTPS origin of the private Node service.
- `BACKEND_SHARED_SECRET`: a random secret of at least 32 characters.

Configure the Node service with the same `BACKEND_SHARED_SECRET`, plus:

- `APP_ORIGIN`: exact HTTPS application origin, with no path or trailing slash.
- `DATABASE_URL`: server-only PostgreSQL connection URL.
- `DATABASE_SSL`: leave unset in production so certificate verification stays enabled; use `false` only for the local container.
- `RESEND_API_KEY`: server-only Resend key used for transactional account email.
- `EMAIL_FROM`: verified sender, for example `JobDiscover <comptes@domain.fr>`.
- `FRANCE_TRAVAIL_CLIENT_ID` and `FRANCE_TRAVAIL_CLIENT_SECRET`.
- Optional DeepSeek and maintenance variables described below.

Apply `web/postgres/migrations/*.sql` with `npm run db:migrate`. Keep application and database logs free of passwords, tokens, email links, e-mail addresses and preference payloads. The confirmation page removes its token from the address bar before the user acts. Sessions use host-only `HttpOnly`, `Secure`, `SameSite=Lax` cookies, and all API writes require an exact same-origin request.

Before opening registration, create two disposable accounts and verify signup, one-use confirmation, login, logout, refresh rotation, recovery, password change, profile/favorite isolation, export and account deletion. Restore a backup into a separate database and document the real retention period.

## 2. France Travail

Create an application at https://francetravail.io/produits-partages/catalogue/offres-emploi and obtain access to Offres d'emploi v2 under its current reuse terms. Configure `FRANCE_TRAVAIL_CLIENT_ID` and `FRANCE_TRAVAIL_CLIENT_SECRET` as secrets. The adapter requests `api_offresdemploiv2 o2dsoffre` scopes using the partner OAuth endpoint.

Validate the adapter against actual credentials: OAuth access, a geographic search, pagination, source links, a current detail, an expired offer and provider throttling. Source descriptions are treated as untrusted plain text. Search includes no narrow job-title filter so the recommender retains discovery candidates. We intentionally retrieve only up to 300 recent results per query, with a 15-minute shared cache; additional coverage needs a later ingestion strategy.

## 3. Optional DeepSeek

Set `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL` (default `deepseek-chat`). Set `AI_PUBLIC_JOB_ENRICHMENT=true` only after reviewing the provider's processing terms for public descriptions. This is disabled by default, including with a key present.

The model only receives a title and public-duty excerpt with detectable contacts removed, never user profile, location or feedback. Automatic text redaction cannot guarantee that every name is removed from public free text. It is not appropriate for CVs or private documents. The enrichment is used on offer detail, is cached by model/content hash, is capped at 30 calls/hour and 150/day and falls back to the original content. Set provider-side budget limits too. Recommendations are available without it.

## 4. Maintenance and private preview

Set a random `CRON_SECRET` of at least 32 characters as a runtime secret. The protected POST `/api/maintenance` deletes expired shared caches and quota rows. To enable the checked-in daily GitHub workflow, configure repository variable `MAINTENANCE_ENABLED=true`, variable `APP_ORIGIN` and secret `CRON_SECRET`. An owner-only Sites preview will not accept anonymous cron calls through its access gate; enable a suitable scheduler when the runtime is accessible or configure an approved dispatch path. The workflow is disabled by default. Query freshness works without the cleanup job; retention cleanup requires it.

Publish only the validated Worker build using Sites. Keep the preview private until external integration tests and privacy notice are complete. `.openai/hosting.json` contains only the project identifier and logical bindings, never secrets. The public-account app uses its PostgreSQL account system; Sites ChatGPT auth is only an outer access gate for the private preview and is not used as the app account identity.

## 5. Required before public opening

Complete the user-facing privacy notice with operator identity and contact, lawful bases, processor terms, storage regions/transfers, data rights and actual retention/backup periods. Set response and operational logging policies so tokens, passwords, emails and preference payloads are not recorded. Configure monitoring of error/status counts without user content. Review provider quotas and signup abuse protection. Verify backup restoration and rollback to the preceding Sites version. Do not claim end-to-end encryption or zero risk.

Review the original Git author metadata before making the existing repository public. The app's new commits use a technical identity. No existing history was rewritten.
