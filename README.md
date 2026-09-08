# JobDiscover

Mobile-first French job discovery. The app lives in `web/`.

- Fictional demo: onboarding, explainable recommendations, filters, likes, maybe, rejection reasons, undo and favorites. State is memory-only.
- Configurable live service: Supabase Auth and PostgreSQL RLS, France Travail offers, optional DeepSeek public-job enrichment, account export and deletion.
- No private account data or API keys are sent to the model or stored in Git.

## Local development

Node 22.13+ is required.

```sh
npm --prefix web ci
cp web/.env.example web/.env.local
npm --prefix web run dev
```

The application runs without external credentials in clearly labelled demo mode. See [Deployment](docs/DEPLOYMENT.md) to activate real accounts and providers. Do not paste secrets into issues, chat, code, screenshots or commits.

## Verification

```sh
npm --prefix web run check
node scripts/check-secrets.mjs
```

PostgreSQL integration checks are in `web/tests/sql/`. Run the bootstrap only in a disposable empty database, then apply the migrations in order and run `isolation.sql`. It verifies cross-account reads/writes/deletes, anonymous access, privileged RPC access, quota enforcement and deletion cascades. The bootstrap emulates the managed Auth schema; it does not exercise the hosted email provider.

## Git

Configure `git config core.hooksPath .githooks` after cloning. Each implementation milestone has its own English subject-only commit. Credentials, personal data, local IDE settings, logs and database dumps are ignored. CI scans tracked content. The original pre-project commit is preserved and may still contain the initial author's identity; review before making this repository public.

## Scope

Search retrieves at most 300 recent offers per geographic query and caches that query for 15 minutes. It does not aggregate every French job listing. France Travail partner coverage depends on partner API consent. Missing schedules are treated conservatively when strict constraints apply. No automatic applications, CV upload, advertising trackers or offline private-data cache.
