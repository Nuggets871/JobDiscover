\set ON_ERROR_STOP on
begin;
insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
insert into public.profiles values(auth.uid(),'{"city":"Test A"}',now());
insert into public.feedback(user_id,job_id,verdict,job) values(auth.uid(),'test-a','like','{}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
insert into public.profiles values(auth.uid(),'{"city":"Test B"}',now());
insert into public.feedback(user_id,job_id,verdict,job) values(auth.uid(),'test-b','like','{}');
do $$ declare n integer; begin
 select count(*) into n from public.profiles; if n<>1 then raise exception 'Profile isolation failed'; end if;
 select count(*) into n from public.feedback; if n<>1 then raise exception 'Feedback isolation failed'; end if;
 update public.profiles set preferences='{}' where user_id='00000000-0000-4000-8000-000000000001';get diagnostics n=row_count;if n<>0 then raise exception 'Cross-user update succeeded';end if;
 delete from public.feedback where user_id='00000000-0000-4000-8000-000000000001';get diagnostics n=row_count;if n<>0 then raise exception 'Cross-user deletion succeeded';end if;
 begin
  insert into public.feedback(user_id,job_id,verdict,job) values('00000000-0000-4000-8000-000000000001','forged','like','{}');
  raise exception 'Cross-user insert succeeded';
 exception when insufficient_privilege then null; end;
 begin perform * from public.job_cache;raise exception 'Cache accessible';exception when insufficient_privilege then null;end;
 begin perform public.consume_rate_limit('forbidden',2,60);raise exception 'Rate limit RPC accessible';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.profiles;raise exception 'Anonymous profile read succeeded';exception when insufficient_privilege then null;end;
 begin perform * from public.feedback;raise exception 'Anonymous feedback read succeeded';exception when insufficient_privilege then null;end;
end $$;
set local role service_role;
do $$ begin
 if not public.consume_rate_limit('test-quota',2,60) then raise exception 'First quota rejected';end if;
 if not public.consume_rate_limit('test-quota',2,60) then raise exception 'Second quota rejected';end if;
 if public.consume_rate_limit('test-quota',2,60) then raise exception 'Quota exceeded';end if;
end $$;
reset role;
delete from auth.users where id='00000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from public.profiles where user_id='00000000-0000-4000-8000-000000000001') or exists(select 1 from public.feedback where user_id='00000000-0000-4000-8000-000000000001') then raise exception 'Account deletion did not cascade';end if;
end $$;
rollback;
select 'Account isolation, privileges, quotas and deletion cascade passed' as result;
