-- Owner-run production smoke test. All fixture records and temporary role changes
-- remain uncommitted and are rolled back. Never remove the final ROLLBACK.
begin;
select set_config('feasted.qa_count','0',true);
create or replace function pg_temp.qa_check(ok boolean, label text) returns void
language plpgsql as $$ begin
 if ok is not true then raise exception 'FAILED: %',label; end if;
 perform set_config('feasted.qa_count',(current_setting('feasted.qa_count')::int+1)::text,true);
end; $$;
select pg_temp.qa_check(to_regclass('public.championship_schedule') is not null,'Calendar installed');
select pg_temp.qa_check((select relrowsecurity from pg_class where oid='public.championship_schedule'::regclass),'Calendar RLS enabled');
select pg_temp.qa_check(not has_table_privilege('authenticated','public.payment_requests','UPDATE'),'Direct payment update denied');
select pg_temp.qa_check(not has_table_privilege('authenticated','public.championship_staff','UPDATE'),'Direct staff role update denied');
select set_config('feasted.qa_owner',(select user_id::text from public.championship_staff where role='admin' order by created_at limit 1),true);
select pg_temp.qa_check(nullif(current_setting('feasted.qa_owner'),'') is not null,'Existing admin present');
select set_config('request.jwt.claim.sub',current_setting('feasted.qa_owner'),true);
set local role authenticated;
select pg_temp.qa_check(public.get_championship_role()='admin','Owner recognized');
with inserted as (
 insert into public.championship_schedule(game,title,starts_at,location)
 values('smash','TRANSACTIONAL QA — NOT PUBLISHED',now()+interval '30 days','QA fixture') returning id
) select set_config('feasted.qa_schedule',id::text,true) from inserted;
select pg_temp.qa_check((select count(*)=1 from public.championship_schedule where id=current_setting('feasted.qa_schedule')::uuid),'Staff schedule write');
select set_config('feasted.qa_event',public.record_championship_event('smash','TRANSACTIONAL QA — NOT PUBLISHED',current_date,'QA Runner','https://example.com/qa','Rollback-only test','[{"player_name":"QA Champion","placement":1},{"player_name":"QA Runner","placement":2}]')::text,true);
select pg_temp.qa_check((select count(*)=2 from public.tournament_results where event_id=current_setting('feasted.qa_event')::uuid),'Atomic event/results write');
insert into public.championship_announcements(title,body,published)
 values('TRANSACTIONAL QA — NOT PUBLISHED','Rollback-only draft',false);
with inserted as (
 insert into public.payment_requests(user_id,payment_type,item_name,amount_cents,transaction_reference,status)
 values(auth.uid(),'tournament','Rollback-only payment test',1,'QA-'||gen_random_uuid()::text,'pending') returning id
) select set_config('feasted.qa_payment',id::text,true) from inserted;
select pg_temp.qa_check((select status='pending' from public.payment_requests where id=current_setting('feasted.qa_payment')::uuid),'Payment begins pending');
-- Test rejection only: no real transaction is represented as verified.
select public.review_championship_payment(current_setting('feasted.qa_payment')::uuid,'rejected');
select pg_temp.qa_check((select status='rejected' and reviewed_by=auth.uid() and reviewed_at is not null from public.payment_requests where id=current_setting('feasted.qa_payment')::uuid),'Admin rejection audited');
reset role;
-- Changes are visible solely within this transaction, not to live sessions.
update public.championship_staff set role='staff' where user_id=current_setting('feasted.qa_owner')::uuid;
set local role authenticated;
select pg_temp.qa_check(public.get_championship_role()='staff','Staff role recognized');
do $$ begin
 begin perform public.review_championship_payment(current_setting('feasted.qa_payment')::uuid,'verified'); raise exception 'Staff reviewed payment';
 exception when raise_exception then if sqlerrm <> 'Admin access required' then raise; end if; end;
 perform pg_temp.qa_check(true,'Staff payment review denied');
 begin perform public.manage_championship_staff('qa@example.invalid','admin'); raise exception 'Staff managed roles';
 exception when insufficient_privilege then null; end;
 perform pg_temp.qa_check(true,'Staff role management denied');
end; $$;
reset role;
delete from public.championship_staff where user_id=current_setting('feasted.qa_owner')::uuid;
set local role authenticated;
select pg_temp.qa_check(public.get_championship_role() is null,'Player has no staff role');
with inserted as (
 insert into public.player_registrations(user_id,player_name,game,tournament_name,event_date,schedule_id)
 values(auth.uid(),'QA Player','pokemon','Spoofed title',date '2000-01-01',current_setting('feasted.qa_schedule')::uuid) returning id
) select set_config('feasted.qa_registration',id::text,true) from inserted;
select pg_temp.qa_check((select game='smash' and tournament_name='TRANSACTIONAL QA — NOT PUBLISHED' and event_date=(select (starts_at at time zone 'America/Los_Angeles')::date from public.championship_schedule where id=current_setting('feasted.qa_schedule')::uuid) from public.player_registrations where id=current_setting('feasted.qa_registration')::uuid),'Server binds registration to schedule');
do $$ begin
 begin
  insert into public.player_registrations(user_id,player_name,game,tournament_name,event_date,schedule_id)
  values(auth.uid(),'QA Player','smash','Duplicate',current_date,current_setting('feasted.qa_schedule')::uuid);
  raise exception 'Duplicate registration accepted';
 exception when unique_violation then null; end;
 perform pg_temp.qa_check(true,'Duplicate registration denied');
 begin perform public.record_championship_event('smash','Forbidden',current_date,null,null,null,'[{"player_name":"QA","placement":1}]'); raise exception 'Player wrote results';
 exception when raise_exception then if sqlerrm <> 'Staff access required' then raise; end if; end;
 perform pg_temp.qa_check(true,'Player results write denied');
end; $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009999',true);
select pg_temp.qa_check((select count(*)=0 from public.payment_requests where id=current_setting('feasted.qa_payment')::uuid),'Other account cannot read payment');
select pg_temp.qa_check((select count(*)=0 from public.player_registrations where id=current_setting('feasted.qa_registration')::uuid),'Other account cannot read registration');
select set_config('request.jwt.claim.sub',current_setting('feasted.qa_owner'),true);
delete from public.player_registrations where id=current_setting('feasted.qa_registration')::uuid;
select pg_temp.qa_check((select count(*)=0 from public.player_registrations where id=current_setting('feasted.qa_registration')::uuid),'Player withdrawal succeeds');
set local role anon;
select pg_temp.qa_check((select count(*)=0 from public.championship_announcements where title='TRANSACTIONAL QA — NOT PUBLISHED'),'Draft announcement private');
do $$ begin
 begin perform 1 from public.payment_requests limit 1; raise exception 'Anonymous read payments';
 exception when insufficient_privilege then null; end;
 perform pg_temp.qa_check(true,'Anonymous payments denied');
 begin perform 1 from public.player_registrations limit 1; raise exception 'Anonymous read registrations';
 exception when insufficient_privilege then null; end;
 perform pg_temp.qa_check(true,'Anonymous registrations denied');
end; $$;
reset role;
select current_setting('feasted.qa_count')::int as assertions_passed, 'All fixtures and temporary role changes are rolled back next' as cleanup;
rollback;
