# Security report

Reference: OWASP ASVS 5.0 (used as a checklist, not a certification). This document
describes what is implemented and tested and what is not. **The application is not claimed to be completely secure.**

## Trust boundaries

- **Browser**: untrusted. Holds only the public anon key and the user's own session.
- **Supabase PostgreSQL**: the authority. Grants, RLS policies and `SECURITY DEFINER` functions decide every read and write.
- **Edge Function `submit-report`**: an extra validation layer in front of the same database function. It runs as the caller (user JWT + anon key), not as the service role.

## Controls

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| Anonymous browsing only reads approved data | `price_reports` has no grants for `anon`/`authenticated`; public reads go through the `public_price_observations` view (approved rows at active shops; no contributor ids) | `tests/db/access-control.test.ts` |
| No anonymous writes | `submit_price_report()` executable by `authenticated` only; table inserts revoked | db tests |
| Verified email before contributing | checked in `submit_price_report()` and `flag_price_report()` (and in the Edge Function) | db tests |
| Trusted fields are server-derived | reporter id = `auth.uid()`, normalized price via `normalize_price()`, status forced to `pending`, timestamps defaulted; Zod schema is `.strict()` so extra fields are rejected | db + unit tests |
| Input validation | Zod in the client and Edge Function; full re-validation in SQL (product exists, shop real and active, unit dimension, price/quantity bounds, date window, plausibility bounds per product) | `reportSchema.test.ts`, db tests |
| Rate limits across instances | counted in the database (10 per 10 min, 60 per 24 h per user; 20 flags/day), serialized with an advisory lock | db test "enforces rate limits" |
| Duplicate detection | partial unique index + explicit check (same user, product, shop, day) | db test |
| Moderation | only `admin`/`moderator` (via `user_roles`, checked by `is_moderator()`); allowed transitions enforced; every decision written to `moderation_events` | db tests |
| No privilege self-escalation | `user_roles` has no insert/update grants; roles are assigned with SQL by the owner | db test |
| Ownership of private data | RLS `user_id = auth.uid()` on meal plans and lists (and parent-ownership on items); profiles readable/updatable only by their owner, only `display_name` updatable | db tests |
| Protected reference data | catalogue and shop writes need `is_admin()`; coordinates and product identities cannot be changed by users | db test |
| SQL injection | no string-built SQL in the app; PostgREST filters built with the client API; search uses a parameterized RPC; import script escapes literals and output is reviewed | db test (search with SQL payload) |
| XSS | React escaping everywhere; `dangerouslySetInnerHTML` banned by lint; map marker HTML contains only escaped numbers; CSP `script-src 'self'` | `xss.test.tsx`, E2E runs under the production CSP |
| Security headers | CSP, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (geolocation self only), `X-Frame-Options: DENY`, COOP — `vercel.json` | E2E server applies the same headers |
| Open redirects | `?next=` validated by `safeRedirectPath()` (same-origin paths only) | `safeRedirect.test.ts` |
| CORS | Edge Function allowlist via `ALLOWED_ORIGINS`; unknown browser origins get 403. CORS is not used as authentication. | code review only (function not yet deployed) |
| CSRF | sessions are bearer tokens sent in the `Authorization` header, not cookies, so there is no ambient credential to forge | design |
| Secrets | `.env*` git-ignored; `.env.example` placeholders only; no service-role key anywhere in the app or function; `npm run check:secrets` scans sources and `dist/` (and decodes JWTs to catch service-role tokens) | script |
| Errors | database messages are mapped to a fixed list of codes before reaching the UI; the Edge Function logs only error codes | code |
| Privacy | no location request on load (only on "Near me", never stored); budgets/pantry kept in device storage; no analytics or third-party trackers; contributor identities never exposed publicly | design, E2E |

## How to run the security tests

```bash
npm run test:db     # access-control, integrity and import tests on the real migrations
npm test            # includes XSS, schema and redirect tests
npm run test:e2e    # production build + production CSP
npm run check:secrets
npm audit --omit=dev
```

## Known gaps

1. **Not tested against live Supabase.** DB tests use PGlite plus a small shim for `auth.users`, `auth.uid()` and Supabase's default grants (`tests/db/supabase-shim.sql`). Behaviour on the hosted platform should be re-checked after `db push`, for example with the live E2E suite.
2. **Edge Function not executed.** It is type-safe by construction and shares the tested schema, but it has not been deployed or called.
3. **`public_price_observations` is a definer-rights view** (deliberate: it exposes approved rows without contributor ids). Supabase's linter will flag it. Do not add columns to it without review.
4. **Session tokens live in `localStorage`** (supabase-js default). An XSS bug would expose them; mitigated by CSP and the no-raw-HTML rule. Native builds should switch to Keychain/Keystore storage (`src/platform/platform.ts`).
5. **`style-src 'unsafe-inline'`** is allowed for map and library inline styles. Scripts are not.
6. **No CAPTCHA on sign-up** and no IP-based limits beyond Supabase Auth defaults. Enable Turnstile/hCaptcha in Supabase before a public launch.
7. **Moderators can approve their own reports.** This is logged in `moderation_events` but not blocked. Acceptable for a solo-founder pilot; revisit when there are more moderators.
8. **Corroboration** counts distinct accounts. Several accounts controlled by one person could inflate it. It is shown as a hint only and never used for ranking.
9. **Dev-only advisories**: `npm audit` reports 3 moderate issues in `uuid` via `@capacitor/cli → xcode` (iOS project tooling, not shipped to browsers). Production dependencies: 0 known vulnerabilities at the time of writing.
10. **Map tiles** come from OpenStreetMap's public servers by default. Their usage policy does not allow heavy production traffic, so switch to a keyed provider before scaling.
11. **Evidence uploads** are not implemented. The column exists but is constrained to `null`.

## Rotating a leaked key

If any key is ever exposed: rotate it in Supabase (Project Settings → API), update the Vercel
environment variables, redeploy, and invalidate active sessions if a JWT secret was involved.
