# Feasted Gaming launch verification — November 9, 2026

The launch database migration is now applied in production. The site is deployed and the core database workflows passed production checks. Real email delivery, actual Venmo reconciliation and real-device/assistive-technology testing remain separate acceptance steps.

## Activated and verified

- Applied `supabase/launch-workflows.sql` in the existing, signed-in Supabase SQL Editor. The editor reported success; `championship_schedule` now returns HTTP 200. Existing owner authorization remains intact.
- Ran `tests/production-smoke.sql` against production: **23 assertions passed**. Fixture records and temporary role changes were contained in a transaction and rolled back. Checks covered schedule writes, atomic tournament/results writes, pending payment creation and audited rejection, staff payment/role-management denial, server-controlled registration details, duplicate rejection, player withdrawal, cross-account privacy, anonymous denial and draft announcement isolation.
- Reloaded the public Arena with the existing owner session. It recognized the admin and loaded the calendar, registration history, schedule form, staff inbox, payment history and staff roster without setup errors.
- Public schedule, results and announcements were empty after rollback; no test events/results/announcements were published. No real payment was marked verified, transferred or refunded. Venmo remains a manual review process.
- **48 local database checks** passed using PostgreSQL/PGlite with simulated Auth roles. The same production smoke script also passed locally with 23 assertions. Local checks include all six game circuits, unsafe media rejection, duplicate podium/player rejection, transaction rollback and duplicate verified-payment references.
- Frontend workflow/security assertions and **116 internal file/anchor links** passed. Two full randomized 20-question trivia rounds also passed, including scoring guards, results and replay. JavaScript syntax checks passed. The frontend suite covers pending-only payments, event-linked registration, private content clearing, role visibility, safe media URLs, escaped announcements, case-insensitive/prototype-safe rankings, calendar files and pre-migration compatibility. Ranking buttons now expose their selected state and retain focus after keyboard activation.
- Live public home, Arena, all five game guides, config/scripts, sitemap and robots returned HTTP 200. Anonymous requests to registrations, payments, staff roster, staff-management RPC and payment-review RPC returned HTTP 401.
- External human-facing links/artwork were checked; the blocked Pokémon image was replaced with an HTTP 200 image. Font preconnect origins returning 404 at their roots do not indicate a broken stylesheet; actual stylesheet URLs returned 200.

## Features available

Tournament archives, six-game rankings, champion/MVP/media highlights, staff scheduling/cancellation, Pasadena-time calendar, calendar-file download, published-event registration, own-registration history/withdrawal, staff inbox, announcements on both pages, account/recovery handling, and admin-only manual Venmo review are implemented. Database protections are now active rather than awaiting migration.

The calendar currently contains **no real upcoming events**. Registration from the calendar requires staff to publish an actual event. A registration request does not confirm a seat or a payment. Rankings/highlights populate when staff record actual results.

- Public Supabase Auth settings returned HTTP 200: email signup enabled, signup not disabled, and automatic email confirmation disabled (confirmation required). These flags do not prove inbox delivery.
- Website code commit `2857bc9bd3fee8bbaad7733cd19bd4c22fee09b3` passed [GitHub checks](https://github.com/nexprometheus/feastedgaming.github.io/actions/runs/42595445454) and [Pages deployment](https://github.com/nexprometheus/feastedgaming.github.io/actions/runs/42595444455). The published home, Arena and both community/Arena scripts matched the committed source exactly after newline normalization.

## Remaining acceptance steps

- Publish the next real event once its game, date, start time, location and fee are confirmed. The owner was asked for these details; no schedule was invented.
- Verify signup/confirmation/recovery email arrival, expired links and post-change sign-in with an actual test inbox. Password-changing steps require the user to enter their own new password. No password was changed during this work.
- Verify actual FormSubmit contact/membership inbox delivery. Provider reachability and correct markup do not prove delivery.
- Match a real Venmo transaction in Venmo before marking it verified. The rollback-only production test exercised rejection and audit attribution; it did not claim payment-provider verification. Duplicate-verification protection passed local tests.
- Finish separate real player/staff/admin browser sessions and second-device persistence. Production tests exercised the actual database policies through transaction-local role/JWT simulation, not separate newly authenticated users.
- A **390 × 738 Chrome phone emulator** was used to verify Arena hero/navigation, calendar, all six leaderboard switches and payment form, plus the main-page hero/mobile menu and trivia start/answer/score. The main mobile menu closed after navigation. Phone header sizing was tightened; a real quiz bug where button styles overrode hidden controls was fixed, with a full playback test added. Final live checks confirmed that Start disappears after starting, Next appears only after answering, and advancing resets the answer controls. Keyboard Tab/Enter switched leaderboards while retaining a visible focus indicator. Physical iOS/Android and screen-reader acceptance remain unverified.

## Repeatable checks

With Node 24, run `npm install --ignore-scripts` then `npm test`. GitHub Actions runs the same automated suite. `tests/production-smoke.sql` is an owner-run rollback-only production check; preserve its final ROLLBACK and never convert its synthetic payment into a real verification.

Deployment and checklist updates are tracked in [issue #1](https://github.com/nexprometheus/feastedgaming.github.io/issues/1). Never commit service-role keys, database credentials, private customer records or inbox contents.
