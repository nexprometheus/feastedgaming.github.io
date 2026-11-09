-- Additive Arena migration. Run AFTER championship-arena-schema.sql and staff-management.sql.
begin;
create table if not exists public.championship_schedule (
 id uuid primary key default gen_random_uuid(),
 game text not null check (game in ('smash','magic','pokemon','lorcana','onepiece','yugioh')),
 title text not null check(length(trim(title)) between 1 and 80),
 starts_at timestamptz not null,
 location text not null check(length(trim(location)) between 1 and 200),
 details text not null default '' check(length(details) <= 2000),
 status text not null default 'scheduled' check(status in ('scheduled','cancelled','completed')),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.championship_schedule enable row level security;
revoke all on public.championship_schedule from anon, authenticated;
grant select on public.championship_schedule to anon, authenticated;
grant insert, update on public.championship_schedule to authenticated;
drop policy if exists "Public schedule" on public.championship_schedule;
create policy "Public schedule" on public.championship_schedule for select using(true);
drop policy if exists "Staff schedule" on public.championship_schedule;
create policy "Staff schedule" on public.championship_schedule for all to authenticated
 using(public.is_championship_staff()) with check(public.is_championship_staff());

alter table public.player_registrations add column if not exists schedule_id uuid
 references public.championship_schedule(id);
drop policy if exists "Players read own registrations" on public.player_registrations;
create policy "Players read own registrations" on public.player_registrations for select to authenticated
 using(user_id = (select auth.uid()));
grant delete on public.player_registrations to authenticated;
drop policy if exists "Players withdraw own registrations" on public.player_registrations;
create policy "Players withdraw own registrations" on public.player_registrations for delete to authenticated
 using(user_id = (select auth.uid()) and (
  (schedule_id is not null and exists(select 1 from public.championship_schedule s where s.id=schedule_id and s.starts_at>now()))
  or (schedule_id is null and event_date >= (now() at time zone 'America/Los_Angeles')::date)));
-- Unique only for the new event selector; preserve legacy registrations without data loss.
create unique index if not exists player_schedule_unique on public.player_registrations(user_id, schedule_id)
 where schedule_id is not null;

create or replace function public.validate_arena_registration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare scheduled public.championship_schedule;
begin
 if length(trim(new.player_name)) not between 1 and 40 or length(coalesce(new.player_note,'')) > 120 then
  raise exception 'Enter a gamer tag of 1–40 characters and a note of at most 120 characters';
 end if;
 if new.schedule_id is null then raise exception 'Choose a scheduled event'; end if;
 -- Serialize against schedule edits while accepting a registration.
 select * into scheduled from public.championship_schedule where id=new.schedule_id for share;
 if not found or scheduled.status <> 'scheduled' or scheduled.starts_at <= now() then
  raise exception 'This event is not open for registration';
 end if;
 new.game := scheduled.game;
 new.tournament_name := scheduled.title;
 new.event_date := (scheduled.starts_at at time zone 'America/Los_Angeles')::date;
 return new;
end; $$;
drop trigger if exists arena_registration_validation on public.player_registrations;
create trigger arena_registration_validation before insert on public.player_registrations
 for each row execute function public.validate_arena_registration();
revoke all on function public.validate_arena_registration() from public, anon, authenticated;

-- These enforce the same result rules for direct RPC callers as for the browser.
create unique index if not exists arena_unique_player on public.tournament_results(event_id, lower(trim(player_name)));
create unique index if not exists arena_unique_podium on public.tournament_results(event_id, placement) where placement <= 3;
alter table public.tournament_results drop constraint if exists arena_player_name_length;
alter table public.tournament_results add constraint arena_player_name_length check(length(trim(player_name)) between 1 and 80) not valid;
alter table public.tournament_results drop constraint if exists arena_placement_limit;
alter table public.tournament_results add constraint arena_placement_limit check(placement <= 999) not valid;
alter table public.tournament_events drop constraint if exists arena_title_length;
alter table public.tournament_events add constraint arena_title_length check(length(trim(tournament_name)) between 1 and 80) not valid;
alter table public.tournament_events drop constraint if exists arena_notes_length;
alter table public.tournament_events add constraint arena_notes_length check(length(coalesce(match_notes,'')) <= 2000) not valid;
alter table public.tournament_events drop constraint if exists arena_safe_highlight;
alter table public.tournament_events add constraint arena_safe_highlight check(highlight_url is null or highlight_url ~ '^https://') not valid;

-- Clients cannot bypass the staff management RPC's self-demotion / last-admin protections.
revoke insert, update, delete on public.championship_staff from authenticated;
-- Payment decisions remain admin-only via review_championship_payment. No provider verification.
revoke update, delete on public.payment_requests from authenticated;
drop policy if exists "Users can read own payment requests" on public.payment_requests;
create policy "Users can read own payment requests" on public.payment_requests for select to authenticated
 using(user_id=(select auth.uid()) or public.is_championship_admin());
revoke insert on public.payment_requests from authenticated;
grant insert(user_id,payment_type,item_name,amount_cents,transaction_reference,status)
 on public.payment_requests to authenticated;
create unique index if not exists arena_verified_reference_unique
 on public.payment_requests(lower(trim(transaction_reference))) where status='verified';
commit;
