-- Feasted Gaming Championship Arena: shared Supabase data model
-- Run this in Supabase SQL Editor after creating a project.
create extension if not exists pgcrypto;

create table if not exists public.championship_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_events (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('smash','magic','pokemon','lorcana','onepiece','yugioh')),
  tournament_name text not null,
  event_date date not null,
  mvp text,
  highlight_url text,
  match_notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tournament_events(id) on delete cascade,
  player_name text not null,
  placement integer not null check (placement > 0),
  created_at timestamptz not null default now(),
  unique(event_id, player_name)
);

create table if not exists public.player_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  player_name text not null,
  game text not null check (game in ('smash','magic','pokemon','lorcana','onepiece','yugioh')),
  tournament_name text not null,
  event_date date not null,
  player_note text,
  created_at timestamptz not null default now()
);

create index if not exists tournament_events_game_date_idx on public.tournament_events(game, event_date desc);
create index if not exists tournament_results_event_placement_idx on public.tournament_results(event_id, placement);
create index if not exists player_registrations_game_date_idx on public.player_registrations(game, event_date desc);

-- Upgrade an existing version of this schema in place.
alter table public.player_registrations add column if not exists user_id uuid references auth.users(id) on delete set null;

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_type text not null check (payment_type in ('tournament','membership')),
  item_name text not null check (length(item_name) between 1 and 100),
  amount_cents integer not null check (amount_cents > 0),
  transaction_reference text not null check (length(transaction_reference) between 1 and 120),
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  staff_note text,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.championship_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 2000),
  published boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.championship_staff enable row level security;
alter table public.tournament_events enable row level security;
alter table public.tournament_results enable row level security;
alter table public.player_registrations enable row level security;
alter table public.payment_requests enable row level security;
alter table public.championship_announcements enable row level security;

create or replace function public.is_championship_staff()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.championship_staff s where s.user_id = (select auth.uid())); $$;

create or replace function public.is_championship_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.championship_staff s where s.user_id = (select auth.uid()) and s.role = 'admin'); $$;

create or replace function public.get_championship_role()
returns text language sql stable security definer set search_path = ''
as $$ select s.role from public.championship_staff s where s.user_id = (select auth.uid()) limit 1; $$;

revoke all on function public.is_championship_staff() from public, anon;
revoke all on function public.is_championship_admin() from public, anon;
revoke all on function public.get_championship_role() from public, anon;
grant execute on function public.is_championship_staff() to authenticated;
grant execute on function public.is_championship_admin() to authenticated;
grant execute on function public.get_championship_role() to authenticated;

create or replace function public.record_championship_event(
  event_game text, event_title text, event_date date, event_mvp text,
  event_highlight_url text, event_match_notes text, event_results jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_event_id uuid;
begin
  if not public.is_championship_staff() then raise exception 'Staff access required'; end if;
  if jsonb_typeof(event_results) <> 'array' or jsonb_array_length(event_results) < 1 or jsonb_array_length(event_results) > 128 then
    raise exception 'Provide between 1 and 128 placements';
  end if;
  insert into public.tournament_events(game, tournament_name, event_date, mvp, highlight_url, match_notes, created_by)
  values (event_game, event_title, event_date, nullif(event_mvp, ''), nullif(event_highlight_url, ''), nullif(event_match_notes, ''), (select auth.uid()))
  returning id into new_event_id;
  insert into public.tournament_results(event_id, player_name, placement)
  select new_event_id, result.player_name, result.placement
  from jsonb_to_recordset(event_results) as result(player_name text, placement integer);
  if not exists (select 1 from public.tournament_results r where r.event_id = new_event_id and r.placement = 1) then
    raise exception 'The event must include a champion at placement 1';
  end if;
  return new_event_id;
end;
$$;
revoke all on function public.record_championship_event(text,text,date,text,text,text,jsonb) from public, anon;
grant execute on function public.record_championship_event(text,text,date,text,text,text,jsonb) to authenticated;

drop policy if exists "Public can read tournament events" on public.tournament_events;
create policy "Public can read tournament events" on public.tournament_events for select using (true);
drop policy if exists "Staff can manage tournament events" on public.tournament_events;
create policy "Staff can manage tournament events" on public.tournament_events for all to authenticated using (public.is_championship_staff()) with check (public.is_championship_staff());

drop policy if exists "Public can read tournament results" on public.tournament_results;
create policy "Public can read tournament results" on public.tournament_results for select using (true);
drop policy if exists "Staff can manage tournament results" on public.tournament_results;
create policy "Staff can manage tournament results" on public.tournament_results for all to authenticated using (public.is_championship_staff()) with check (public.is_championship_staff());

drop policy if exists "Public can create player registrations" on public.player_registrations;
drop policy if exists "Players can register themselves" on public.player_registrations;
create policy "Players can register themselves" on public.player_registrations for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Staff can read registrations" on public.player_registrations;
create policy "Staff can read registrations" on public.player_registrations for select to authenticated using (public.is_championship_staff());
drop policy if exists "Staff can manage registrations" on public.player_registrations;
create policy "Staff can manage registrations" on public.player_registrations for update to authenticated using (public.is_championship_staff()) with check (public.is_championship_staff());
drop policy if exists "Admins can manage staff roster" on public.championship_staff;
create policy "Admins can manage staff roster" on public.championship_staff for all to authenticated using (public.is_championship_admin()) with check (public.is_championship_admin());

drop policy if exists "Users can read own payment requests" on public.payment_requests;
create policy "Users can read own payment requests" on public.payment_requests for select to authenticated using ((select auth.uid()) = user_id or public.is_championship_staff());
drop policy if exists "Users can create pending payment requests" on public.payment_requests;
create policy "Users can create pending payment requests" on public.payment_requests for insert to authenticated with check ((select auth.uid()) = user_id and status = 'pending' and reviewed_by is null and reviewed_at is null);
drop policy if exists "Staff can review payment requests" on public.payment_requests;
drop policy if exists "Admins can review payment requests" on public.payment_requests;

create or replace function public.review_championship_payment(payment_id uuid, decision text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_championship_admin() then raise exception 'Admin access required'; end if;
  if decision not in ('verified','rejected') then raise exception 'Decision must be verified or rejected'; end if;
  update public.payment_requests
  set status = decision, reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = payment_id and status = 'pending';
  if not found then raise exception 'Payment request was not found or is already reviewed'; end if;
end;
$$;
revoke all on function public.review_championship_payment(uuid,text) from public, anon;
grant execute on function public.review_championship_payment(uuid,text) to authenticated;

drop policy if exists "Public can read published announcements" on public.championship_announcements;
create policy "Public can read published announcements" on public.championship_announcements for select using (published = true);
drop policy if exists "Staff can manage announcements" on public.championship_announcements;
create policy "Staff can manage announcements" on public.championship_announcements for all to authenticated using (public.is_championship_staff()) with check (public.is_championship_staff());

-- Explicit table grants keep the REST API surface aligned with the RLS policies.
revoke all on public.championship_staff, public.tournament_events, public.tournament_results,
  public.player_registrations, public.payment_requests, public.championship_announcements from anon, authenticated;
grant select, insert, update, delete on public.championship_staff to authenticated;
grant select on public.tournament_events, public.tournament_results to anon, authenticated;
grant select, insert, update on public.player_registrations to authenticated;
grant select, insert on public.payment_requests to authenticated;
grant select on public.championship_announcements to anon, authenticated;
grant insert, update, delete on public.championship_announcements to authenticated;
