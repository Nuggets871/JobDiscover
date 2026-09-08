create extension if not exists pgcrypto;
create extension if not exists citext;

create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique check (length(email::text) between 3 and 254),
  password_hash text not null check (length(password_hash) between 80 and 180),
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index auth_sessions_by_user on auth_sessions(user_id);
create index auth_sessions_expiry on auth_sessions(expires_at);

create table profiles (
  user_id uuid primary key references users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb check (octet_length(preferences::text)<12000),
  updated_at timestamptz not null default now()
);

create table feedback (
  user_id uuid not null references users(id) on delete cascade,
  job_id text not null check(length(job_id) between 1 and 64),
  verdict text not null check(verdict in ('like','maybe','reject')),
  reason text check(reason in ('missions','distance','salary','hours','qualification','other')),
  job jsonb not null check(octet_length(job::text)<40000),
  created_at timestamptz not null default now(),
  primary key(user_id,job_id)
);
create index feedback_by_user on feedback(user_id,created_at desc);

create table rate_limits(bucket char(64) primary key, hits integer not null, expires_at timestamptz not null);
create or replace function consume_rate_limit(bucket_key text,max_hits integer,window_seconds integer)
returns boolean language plpgsql as $$
declare n integer;
begin
  if max_hits<1 or window_seconds<1 or window_seconds>86400 then return false; end if;
  insert into rate_limits as r(bucket,hits,expires_at) values(bucket_key,1,now()+make_interval(secs=>window_seconds))
  on conflict(bucket) do update set hits=case when r.expires_at<=now() then 1 else r.hits+1 end,
  expires_at=case when r.expires_at<=now() then now()+make_interval(secs=>window_seconds) else r.expires_at end returning hits into n;
  return n<=max_hits;
end $$;

create table job_cache(id text primary key,job jsonb not null,checked_at timestamptz not null default now());
create index jobs_checked on job_cache(checked_at);
create table offer_searches(key text primary key,jobs jsonb not null,fetched_at timestamptz not null default now(),partial boolean not null default false);
create table job_enrichment(hash char(64) primary key,summary text not null,tags jsonb not null,created_at timestamptz not null default now());