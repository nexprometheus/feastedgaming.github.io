# Feasted Gaming launch status — November 9, 2026

The launch checklist is **not fully complete**. Code implementation, local tests, live API checks, and real user workflows are distinct evidence levels. No automatic Venmo verification exists.

## Implemented

- Tournament history, champion and MVP highlights, safe HTTPS media links, and separate rankings for Smash, Magic, Pokémon, Lorcana, One Piece, and Yu-Gi-Oh. Rankings award 5/3/2/1 points; gamer tags are grouped without regard to case, with ties sorted by wins and gamer tag.
- Staff event scheduling, cancellation/closure, Pasadena-time public calendar, calendar-file download, and registration from a published future event.
- Player registration history and withdrawal; staff registration inbox. Existing freeform requests remain available while the calendar migration is absent. Neither a request nor a payment submission confirms a seat.
- Signup, sign-in, sign-out, password-recovery request and validated email-link/password-update handling. Session expiry and sign-out clear private page content. Real email delivery remains untested.
- Published announcements on the Arena and main page; main-page links to player accounts and manual payment history.
- Pending Venmo payment requests, admin-only manual review, and review attribution. New migration prevents verifying the same normalized transaction reference twice. A reference is a customer claim until matched manually against Venmo.
- Additive, transactional, repeatable `supabase/launch-workflows.sql`; new result validation, own-registration policies, admin-only payment visibility, protected staff-role writes, and duplicate protections.
- Responsive source styles, visible keyboard focus, 44px Arena controls, 16px inputs, and scrollable staff tables. These source changes are not a completed visual/accessibility audit.
- Pokémon artwork returning 403 replaced with a verified HTTP 200 image URL.

## Verified

- `node tests/frontend.mjs`: workflow/security assertions plus **116 internal file and anchor links**. Includes event-linked registration payload, pending-only payment submission, role visibility, private content clearing, safe links, escaped announcements, prototype-safe rankings, ICS output, and migration fallback.
- `node tests/database.mjs`: **48 checks** using local PostgreSQL/PGlite and simulated Supabase Auth roles. Includes repeated migration, anonymous denial, ownership isolation, event validation, duplicate registrations, staff/admin boundaries, payment auditing and duplicate verified references, unpublished announcement isolation, and transactional result rollback for all six games. PGlite uses built-in UUID generation in place of production pgcrypto.
- JavaScript syntax checks and Git whitespace check passed.
- GitHub Actions suite passed for implementation commit `b75b3ce35f5850cf89920b1f405f460c8b9cdae9`: [run](https://github.com/nexprometheus/feastedgaming.github.io/actions/runs/42592063499).
- GitHub Pages deployed that implementation commit successfully: [deployment](https://github.com/nexprometheus/feastedgaming.github.io/actions/runs/42592060790). Later documentation/artwork commits have their own deployment status; do not infer it from this run.
- Public home, Arena, five game guides, Arena script/config, sitemap, and robots returned HTTP 200 during this session.
- Live anonymous requests to registrations, payments, and staff roster returned HTTP 401; anonymous staff-management and payment-review RPCs returned HTTP 401. This is a limited anonymous-boundary check, not a complete production RLS audit.
- Existing signed-in owner dashboard, empty inbox/payment records, and staff-management roster were observed in Chrome; owner also confirmed Arena/staff management working. No role changes were performed during these observations.
- External navigable destinations and artwork URLs were checked. Font preconnect origins return 404 at their roots, which is not a broken stylesheet; actual stylesheet URLs return 200. The blocked artwork was replaced with a tested image URL.

## Required before calling launch complete

1. **Apply `supabase/launch-workflows.sql`** in the existing project's SQL Editor, after the already installed Arena/staff migrations. Live `championship_schedule` returned 404/PGRST205: this migration was not applied during this session. The calendar, registration history/withdrawal, and new database protections are therefore not yet activated in production. Do not re-bootstrap or alter the existing owner account.
2. Publish an actual upcoming event through the staff form. No fake events, results, registrations, announcements, or payments were inserted into production for testing.
3. Use separate real player, staff and admin sessions to verify own-record privacy, registration persistence on another device, withdrawals, result/highlight publishing, announcements, staff management safeguards, and payment review. Local role tests do not establish these production outcomes.
4. Verify signup/confirmation/recovery email delivery and redirect allowlist, including expired links. Verify sign-in again after a password change. No user password was changed in this session.
5. Match a real Venmo transaction manually, then test pending → verified/rejected and duplicate-reference behavior. No Venmo transaction, refund, membership activation or payment verification was performed.
6. Finish real mobile/desktop visual and keyboard/screen-reader testing. The in-app browser could not reach the local preview; desktop automation subsequently stopped because it could not determine the active browser URL reliably. No claim of mobile or full accessibility verification is made.
7. Test actual FormSubmit contact and membership email delivery. Existing markup and provider reachability do not prove inbox delivery.
8. Recheck deployed version after the latest commit, including the updated image and cache-busted Arena/main community scripts. Preserve this distinction when updating issue #1.

Run `npm install --ignore-scripts` and `npm test` with Node 24 to repeat the automated suite. Tests use local fixtures and do not write production data. Apply migrations only in the trusted Supabase SQL Editor; never commit service-role keys, database credentials or private test records.
