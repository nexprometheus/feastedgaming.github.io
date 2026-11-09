-- Feasted Gaming initial Supabase schema
-- Run once in Supabase SQL Editor. Never put secret keys in GitHub.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Player',
 created_at timestamptz not null default now()
);
create table if not exists public.staff_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('admin','staff')),
 created_at timestamptz not null default now()
);
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.staff_members where user_id = (select auth.uid()));
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.staff_members where user_id = (select auth.uid()) and role='admin');
$$;
revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
create table if not exists public.games (
 id text primary key,
 name text not null
);
insert into public.games(id,name) values
 ('smash','Super Smash Bros'),('mtg','Magic: The Gathering'),('pokemon','Pokémon'),('lorcana','Disney Lorcana'),('onepiece','One Piece'),('yugioh','Yu-Gi-Oh')
on conflict(id) do nothing;
create table if not exists public.tournaments (
 id uuid primary key default gen_random_uuid(),
 game_id text not null references public.games(id),
 title text not null,
 starts_at timestamptz not null,
 location text,
 status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.registrations (
 tournament_id uuid not null references public.tournaments(id) on delete cascade,
 player_id uuid not null references public.profiles(id) on delete cascade,
 registered_at timestamptz not null default now(),
 primary key(tournament_id,player_id)
);
create table if not exists public.results (
 tournament_id uuid not null references public.tournaments(id) on delete cascade,
 player_id uuid not null references public.profiles(id) on delete cascade,
 placement integer not null check(placement > 0),
 points integer not null default 0 check(points >= 0),
 highlight text,
 primary key(tournament_id,player_id),
 unique(tournament_id,placement)
);
create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 body text not null,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.payment_requests (
 id uuid primary key default gen_random_uuid(),
 player_id uuid not null references public.profiles(id),
 membership_tier text not null,
 amount_cents integer not null check(amount_cents > 0),
 status text not null default 'pending' check(status in ('pending','verified','rejected')),
 venmo_reference text,
 verified_by uuid references auth.users(id),
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 constraint payment_verified_fields check (
  (status='verified' and verified_by is not null and verified_at is not null)
  or (status<>'verified' and verified_at is null)
 )
);
create or replace function public.protect_payment_verification()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.status is distinct from old.status or new.verified_by is distinct from old.verified_by or new.verified_at is distinct from old.verified_at then
  if not public.is_staff() then raise exception 'Staff authorization required'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists payment_verification_guard on public.payment_requests;
create trigger payment_verification_guard before update on public.payment_requests
for each row execute function public.protect_payment_verification();
create or replace view public.championship_rankings with (security_invoker=true) as
select t.game_id, r.player_id, p.display_name, count(*)::integer as tournaments_played,
sum(r.points)::bigint as total_points,
count(*) filter(where r.placement=1)::integer as wins
from public.results r join public.tournaments t on t.id=r.tournament_id
join public.profiles p on p.id=r.player_id
where t.status='completed'
group by t.game_id,r.player_id,p.display_name;
alter table public.profiles enable row level security;
alter table public.staff_members enable row level security;
alter table public.games enable row level security;
alter table public.tournaments enable row level security;
alter table public.registrations enable row level security;
alter table public.results enable row level security;
alter table public.announcements enable row level security;
alter table public.payment_requests enable row level security;
create policy "Public profiles readable" on public.profiles for select to anon,authenticated using(true);
create policy "Players create own profile" on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy "Players edit own profile" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy "Staff roster restricted" on public.staff_members for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
create policy "Admins manage staff" on public.staff_members for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Games publicly readable" on public.games for select to anon,authenticated using(true);
create policy "Tournaments publicly readable" on public.tournaments for select to anon,authenticated using(true);
create policy "Staff manage tournaments" on public.tournaments for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "Registrations visible to owners and staff" on public.registrations for select to authenticated using(player_id=(select auth.uid()) or public.is_staff());
create policy "Players register themselves" on public.registrations for insert to authenticated with check(player_id=(select auth.uid()) and exists(select 1 from public.tournaments where id=tournament_id and status='scheduled'));
create policy "Players withdraw themselves" on public.registrations for delete to authenticated using(player_id=(select auth.uid()) or public.is_staff());
create policy "Results publicly readable" on public.results for select to anon,authenticated using(true);
create policy "Staff manage results" on public.results for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "Published announcements public" on public.announcements for select to anon,authenticated using(published=true or public.is_staff());
create policy "Staff manage announcements" on public.announcements for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy "Payments visible to owner or staff" on public.payment_requests for select to authenticated using(player_id=(select auth.uid()) or public.is_staff());
create policy "Staff manage payments" on public.payment_requests for all to authenticated using(public.is_staff()) with check(public.is_staff());
-- No customer insert policy for payments: requests should be created by trusted backend
-- after validating tier and amount, never from untrusted browser fields.
-- Bootstrap the first admin manually in SQL Editor after creating an Auth user:
-- insert into public.staff_members(user_id,role) values ('AUTH_USER_UUID_HERE','admin');
