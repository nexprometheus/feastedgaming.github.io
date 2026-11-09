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

The public project URL and publishable key are now present in `assets/site-config.js`. The existing Arena and staff management were confirmed working by the owner and observed in the signed-in dashboard on November 9, 2026. Do not re-bootstrap the owner. The additive launch migration described below was applied successfully in production on November 9, 2026; its 23 rollback-only production assertions passed. No private credentials belong in this repository.


## Launch workflow migration (November 9, 2026)

Run `launch-workflows.sql` after the existing Arena and staff-management migrations. It adds the shared schedule, event-linked registration, owner-only registration history and withdrawal, and database result validation. It also limits payment reads to the player or admin, blocks duplicate verified references, and requires staff role changes to use the protected management RPC. It does not change anyone’s existing role.

This migration is transactional and repeatable. Unique indexes intentionally fail if legacy results or verified references conflict; inspect and reconcile those records before retrying rather than deleting them blindly. New result length/URL checks apply to new writes; existing rows are not retroactively validated.

The migration is now active. The refreshed Arena loads the calendar, own-registration history and staff schedule form. Publish a real upcoming event using the staff form once its schedule is confirmed. No published events are fabricated.

Password recovery needs email delivery and the Arena redirect allowlist in Supabase Auth. The browser handles validated implicit email-link tokens, clears tokens from the URL, and submits password updates to Supabase. Real signup/confirmation/recovery delivery has not been tested.

## Repeatable automated checks

Run `npm install --ignore-scripts` and `npm test` with Node 24. These run frontend workflow/link assertions, two complete randomized trivia rounds, 48 database checks and the 23-assertion rollback-only smoke script locally using PGlite with simulated Supabase Auth roles. GitHub Actions runs the same suite. These tests do not replace production role/account, email, payment-provider, accessibility, or mobile browser testing. See `../LAUNCH-STATUS.md`.
