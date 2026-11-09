# Feasted Gaming Supabase setup

The Championship Arena uses one shared schema: `championship-arena-schema.sql`. It supports player accounts and registrations, public event history and rankings, staff-only result entry, published announcements, and payment requests that remain pending until an admin manually reviews Venmo.

There is also an older, separate `schema.sql` in this folder. It is not used by the current Arena page. Run only `championship-arena-schema.sql`; do not apply both models as a combined setup.

## Connect the project

1. Create or select the Feasted Gaming project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Open **Project Settings → API** and copy the Project URL and the publishable (anon) key.
3. Put those two public client values into `assets/site-config.js` as `url` and `anonKey`. The publishable key is meant for browser use. **Never use the `service_role` key or database password in this file or anywhere in this repository.** Row Level Security is the security boundary.
4. In **SQL Editor**, run `championship-arena-schema.sql` once. It can also upgrade the earlier Championship Arena schema.
5. In **Authentication → URL Configuration**, set the site URL to `https://nexprometheus.github.io/feastedgaming.github.io/` and add `https://nexprometheus.github.io/feastedgaming.github.io/championship.html` as a redirect URL.
6. Create an account from the Arena page and confirm its email. In SQL Editor, promote the owner's Auth user UUID:

   ```sql
   insert into public.championship_staff (user_id, role)
   values ('OWNER_AUTH_USER_UUID', 'admin')
   on conflict (user_id) do update set role = 'admin';
   ```

   Add trusted tournament operators as `staff`. Admins alone can manage the staff roster and review payment records. Staff can record tournament results and read the registration inbox.

The configuration file contains only the public project URL and publishable key. Do not store email passwords, service-role keys, or database credentials in GitHub. Static GitHub Pages cannot keep browser configuration private; Supabase RLS must remain enabled.

## What the policies enforce

- Anyone can read tournament history, placements, rankings, and published announcements.
- A signed-in player can create registrations only for their own Auth user ID. Anonymous registration writes are denied.
- Staff/admin accounts can read registrations and record complete tournament events through a database function. Event plus placements are inserted in one transaction.
- Only an admin can review a payment request. Players can create a pending record and read only their own payment history.
- A user-submitted Venmo reference stays **pending**. The admin must compare it against the Venmo account before marking it verified. No Venmo link or client-side claim confirms a payment.
- Staff announcements are public only after publication. Staff tools remain hidden until the authenticated role is confirmed by Supabase.

## Launch checks

- Configure the Supabase URL and publishable key in `assets/site-config.js`.
- Run the SQL schema and promote the owner account as described above.
- Confirm signup email delivery and the site redirect URL in Supabase Auth.
- Sign in as a player and confirm registration/payment records persist across a second device. Verify players cannot see other users' payment records.
- Sign in as staff and confirm results, announcements, and registration access work; confirm staff cannot review payments or alter the staff roster.
- Sign in as admin and verify each test payment against Venmo before changing its status.
- Export and securely retain database backups from Supabase. Do not put personal payment data or database backups in the public repository.

Until the owner performs the Supabase setup and supplies the public configuration, the Arena can show legacy browser-local history, but account registration, shared event writes, announcements, and payment records remain unavailable. No private credentials are required in this repository.
