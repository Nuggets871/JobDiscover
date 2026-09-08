# Validation record

## Passed locally

- TypeScript compilation and production Worker build.
- Lint for application, server and tests. Unmodified scaffold component primitives and the scaffold mobile hook are excluded from application lint; they remain covered by TypeScript and are not edited to satisfy unrelated lint rules.
- 20 automated tests: constraint enforcement including unknown schedules, unbiased rejection reasons, feedback decay and caps, cold start explanations, exploration diversity across successive cards, payload validation, owner-field stripping, CSRF Origin rejection, body-size limits, secure cookie flags, missing-config fail-closed behavior, safe links, provider normalization, token-free login responses, password-preserving login, deletion reauthentication, opaque service-key headers and WebMCP contracts.
- Real PostgreSQL 18 disposable database with the production migrations and a minimal Auth schema: cross-account SELECT/UPDATE/DELETE/INSERT isolation, anonymous access denial, server-only cache/RPC access, atomic quota enforcement and account deletion cascades.
- Mobile browser at 390×844 and 320×740: no horizontal overflow; all reaction buttons visible above navigation; like and favorite retrieval; rejection reason and undo; onboarding; a no-weekend preference changes the offered job and its explanation.
- WebMCP in a supported browser: read_current_job returns the displayed offer; navigate_jobdiscover updates the visible tab; unexpected fields and unsupported views fail without changing state.
- npm dependency audit after updating vulnerable starter dependencies: zero known vulnerabilities. This is a point-in-time dependency check, not a security certification.

## External activation checks still required

No real Supabase, France Travail or DeepSeek credentials were available during implementation. Hosted signup/email confirmation/recovery, a complete live-account browser journey, real France Travail responses/scopes, DeepSeek output quality and provider quotas remain unverified. The local SQL Auth stub does not substitute for managed Supabase Auth integration tests.

Public registration must remain closed until external configuration, legal operator details, logging policies, backup retention/restoration and live isolation checks are complete. The initial deployment is a private demo. The server adapters and database migrations are ready for integration, not proof of a configured live service.

Maintenance workflow exists but is disabled until deployment access and its secret are configured. Hosted backup/monitoring configuration depends on the operator's service accounts. No paid plan, domain, SMTP service or credentials were created or purchased.

- Production HTTP smoke checks: expected page/API statuses, private no-store caching, CSP on every tested route, cross-origin mutation rejection and matching nonces on all 21 initial script elements.
