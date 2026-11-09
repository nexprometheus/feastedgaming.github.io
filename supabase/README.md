# Feasted Gaming Championship Arena — Supabase setup

The live Championship Arena currently has a browser-local storage implementation. This SQL file creates the shared database tables and row-level security rules needed for the six game circuits.

## 1. Create the Supabase project
Create a project at https://supabase.com/dashboard. In **Project Settings → API**, copy the Project URL and the **publishable/anon** client key. Never use or publish the service-role key in browser code.

## 2. Create the database tables
Open **SQL Editor → New query**, paste the contents of `championship-arena-schema.sql`, and run it.

Tables created:
- `tournament_events`: game, tournament title/date, MVP, highlight URL, notes
- `tournament_results`: champion, runner-up, third place, and all other placements
- `player_registrations`: player sign-ups
- `championship_staff`: authorized staff/admin user IDs

Supported game IDs: `smash`, `magic`, `pokemon`, `lorcana`, `onepiece`, `yugioh`.

## 3. Create the first staff account
In Supabase **Authentication → Users**, invite the owner/staff email and have that person complete sign-in. Copy that user's UUID, then run this in SQL Editor (replace the placeholder):
```sql
insert into public.championship_staff (user_id, role)
values ('PASTE_AUTH_USER_UUID_HERE', 'admin')
on conflict (user_id) do update set role = 'admin';
```
Add other authorized staff by inserting their Auth user UUID with role `staff`. Only admins can manage the staff roster.

## 4. Connect the website
The frontend still needs the Supabase project URL and publishable/anon key wired into its client configuration, and the Championship Arena JavaScript must be switched from localStorage to Supabase reads/writes and authenticated staff checks. Those values are project-specific and cannot be inferred from GitHub access.

## Security notes
- Do not place a service-role key in `index.html`, `championship.html`, or any public repository file.
- Public visitors can view tournament events/results and submit player registrations.
- Only authenticated users listed in `championship_staff` can record or edit event results.
- Review public registration abuse controls (CAPTCHA/rate limiting) before opening registration widely.
