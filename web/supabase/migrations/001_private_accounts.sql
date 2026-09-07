begin;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 preferences jsonb not null default '{}'::jsonb check (octet_length(preferences::text) < 12000),
 updated_at timestamptz not null default now()
);
create table public.feedback (
 user_id uuid not null references auth.users(id) on delete cascade,
 job_id text not null check(length(job_id) between 1 and 64),
 verdict text not null check(verdict in ('like','maybe','reject')),
 reason text check(reason in ('missions','distance','salary','hours','qualification','other')),
 job jsonb not null check(octet_length(job::text)<40000),
 created_at timestamptz not null default now(),
 primary key(user_id,job_id)
);
alter table public.profiles enable row level security;
alter table public.feedback enable row level security;
revoke all on public.profiles, public.feedback from anon;
grant select,insert,update,delete on public.profiles,public.feedback to authenticated;
create policy own_profile on public.profiles for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_feedback on public.feedback for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index feedback_by_user on public.feedback(user_id,created_at desc);

-- Privileged service-only operations. Public API users cannot inspect quota keys.
create table public.rate_limits(bucket text primary key, hits integer not null, expires_at timestamptz not null);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon,authenticated;
create or replace function public.consume_rate_limit(bucket_key text,max_hits integer,window_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if max_hits<1 or window_seconds<1 or window_seconds>86400 then return false; end if;
 delete from public.rate_limits where expires_at<now()-interval '1 day';
 insert into public.rate_limits as r(bucket,hits,expires_at) values(bucket_key,1,now()+make_interval(secs=>window_seconds))
 on conflict(bucket) do update set hits=case when r.expires_at<=now() then 1 else r.hits+1 end,
 expires_at=case when r.expires_at<=now() then now()+make_interval(secs=>window_seconds) else r.expires_at end returning hits into n;
 return n<=max_hits;
end $$;
revoke all on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;
commit;
