-- Run once in Supabase SQL Editor. Existing admins remain unchanged.
-- All RPCs require an authenticated Championship admin.
create or replace function public.list_championship_staff()
returns table(user_id uuid, email text, role text)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_championship_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query
  select s.user_id, u.email::text, s.role
  from public.championship_staff s
  join auth.users u on u.id = s.user_id
  order by s.role, u.email;
end;
$$;

create or replace function public.manage_championship_staff(target_email text, new_role text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  target_id uuid;
  current_role text;
begin
  if not public.is_championship_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if target_email is null or length(trim(target_email)) < 3 then raise exception 'Enter a valid account email'; end if;
  if new_role not in ('staff','admin','remove') then raise exception 'Invalid staff role'; end if;
  select id into target_id from auth.users where lower(email) = lower(trim(target_email));
  if target_id is null then raise exception 'No existing player account found for that email'; end if;
  -- Prevent removing or demoting yourself; prevents accidental owner lockout.
  if target_id = auth.uid() and new_role <> 'admin' then
    raise exception 'You cannot remove or demote your own admin account';
  end if;
  -- Serialize staff changes to avoid concurrent last-admin removal.
  perform pg_advisory_xact_lock(582174);
  select role into current_role from public.championship_staff where user_id = target_id;
  if current_role = 'admin' and new_role <> 'admin'
     and (select count(*) from public.championship_staff where role = 'admin') <= 1 then
    raise exception 'Cannot remove the last admin';
  end if;
  if new_role = 'remove' then
    delete from public.championship_staff where user_id = target_id;
  else
    insert into public.championship_staff(user_id, role) values (target_id, new_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
end;
$$;

revoke all on function public.list_championship_staff() from public, anon;
revoke all on function public.manage_championship_staff(text,text) from public, anon;
grant execute on function public.list_championship_staff() to authenticated;
grant execute on function public.manage_championship_staff(text,text) to authenticated;
