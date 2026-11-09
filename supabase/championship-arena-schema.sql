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

alter table public.championship_staff enable row level security;
alter table public.tournament_events enable row level security;
alter table public.tournament_results enable row level security;
alter table public.player_registrations enable row level security;

create or replace function public.is_championship_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.championship_staff s where s.user_id = auth.uid()); $$;

create or replace function public.is_championship_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.championship_staff s where s.user_id = auth.uid() and s.role = 'admin'); $$;

drop policy if exists "Public can read tournament events" on public.tournament_events;
create policy "Public can read tournament events" on public.tournament_events for select using (true);
drop policy if exists "Staff can manage tournament events" on public.tournament_events;
create policy "Staff can manage tournament events" on public.tournament_events for all to authenticated using (public.is_championship_staff()) with check (public.is_championship_staff());

drop policy if exists "Public can read tournament results" on public.tournament_results;
create policy "Public can read tournament results" on public.tournament_results for select using (true);
drop policy if exists "Staff can manage tournament results" on public.tournament_results;
create policy "Staff can manage tournament results" on public.tournament_results for all to authenticated using (public.is_championship_staff()) with check (public.is_championship_staff());

drop policy if exists "Public can create player registrations" on public.player_registrations;
create policy "Public can create player registrations" on public.player_registrations for insert with check (true);
drop policy if exists "Staff can read registrations" on public.player_registrations;
create policy "Staff can read registrations" on public.player_registrations for select to authenticated using (public.is_championship_staff());
drop policy if exists "Staff can manage registrations" on public.player_registrations;
create policy "Staff can manage registrations" on public.player_registrations for update to authenticated using (public.is_championship_staff()) with check (public.is_championship_staff());
drop policy if exists "Admins can manage staff roster" on public.championship_staff;
create policy "Admins can manage staff roster" on public.championship_staff for all to authenticated using (public.is_championship_admin()) with check (public.is_championship_admin());
