begin;
create table public.job_enrichment(hash text primary key,summary text not null,tags jsonb not null,created_at timestamptz not null default now());
alter table public.job_enrichment enable row level security;
revoke all on public.job_enrichment from anon,authenticated;
grant all on public.job_enrichment to service_role;
commit;
