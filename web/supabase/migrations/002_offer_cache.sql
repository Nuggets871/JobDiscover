begin;
create table public.job_cache(id text primary key,job jsonb not null,checked_at timestamptz not null default now());
create table public.offer_searches(key text primary key,jobs jsonb not null,fetched_at timestamptz not null default now(),partial boolean not null default false);
alter table public.job_cache enable row level security;
alter table public.offer_searches enable row level security;
-- Cache is server-only; it never contains account identifiers or profiles.
revoke all on public.job_cache,public.offer_searches from anon,authenticated;
grant all on public.job_cache,public.offer_searches to service_role;
create index jobs_checked on public.job_cache(checked_at);
commit;
