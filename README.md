# As3ari — map-first grocery price intelligence for Algeria

As3ari shows **grocery prices people actually saw** at physical shops and markets, on a map.
Visitors search a product, compare dated, reported prices between locations, and plan a
week of affordable household meals from structured recipes and local prices.

It is **not** a store: there is no cart, checkout, payment, delivery or seller inventory.
The "shopping list" is an informational checklist for shopping in physical stores.

Pilot area: **Djelfa (wilaya 17)**. The data model supports all wilayas, but no coverage is
claimed where no genuine observations exist.

---

## What works today

| Area | Status |
| --- | --- |
| Map-first explore screen (Leaflet), product search (EN/FR/AR, typo-tolerant), price pins, shop panel, map/list toggle, filters (freshness, commune, price range), sorting (unit price, recency, distance after explicit "Near me") | ✅ |
| Price model: separate products / shops / observations, history kept, unit normalization (DZD/kg, /L, /item) with decimal arithmetic, category-based freshness, "lowest reported" only with ≥2 current shops, coverage disclosure | ✅ |
| Product price-history page and shop page (paginated, no invented trends) | ✅ |
| Deterministic 7-day meal planner (16 structured recipes, exclusions, pantry, budget pass, missing/stale price disclosure) + informational checklist | ✅ |
| Supabase schema, RLS, trusted `submit_price_report()` (validation, normalization, DB rate limits, duplicate guard, pending status), flags, moderation with audit trail | ✅ tested in PGlite (real Postgres) |
| Contribution UI (sign-in/sign-up, verified-email requirement, my reports, moderation queue) | ✅ code complete — needs a configured Supabase project to run |
| `submit-report` Edge Function (Zod, CORS allowlist, size limits) | ⚠️ written, **not yet deployed or executed** |
| Localization EN / FR / AR with RTL | ✅ |
| Vercel deployment | ⚠️ configured (`vercel.json`), **not yet deployed** — needs the founder's account |
| Capacitor (Android/iOS) | ⚠️ config only; native projects not generated or built |

Without Supabase credentials the app runs in **demo mode** on clearly-labelled synthetic
data (purple "Demo" badges and a banner on every screen). Contributions are then disabled,
not simulated.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173 — demo mode, no account or backend needed
```

### Checks

```bash
npm run typecheck      # TypeScript (strict)
npm run lint           # ESLint
npm test               # unit tests (units, money, freshness, comparison, search, planner, i18n, XSS)
npm run test:db        # database security tests: real migrations in PGlite as anon / users / admin
npm run build          # production build
npm run test:e2e       # Playwright: full visitor journey on mobile + desktop, under the production CSP
npm run check:secrets  # scans tracked files and dist/ for privileged keys
npm audit --omit=dev   # production dependency audit
npm run check:all      # typecheck + lint + all vitest + build + secrets
```

Playwright needs a browser once: `npx playwright install chromium`.

## Connecting a real backend

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for exact Supabase + Vercel steps
(migrations, auth settings, edge function, first admin, environment variables).

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(public values). **Never** put a service-role key in a `VITE_` variable.

## Adding genuine data

Real shops and prices are added through a reviewed CSV → SQL process:
**[docs/DATA_IMPORT.md](docs/DATA_IMPORT.md)**. Demo data lives only in
`supabase/demo_seed.sql` and can be deleted with two SQL statements.

## Project layout

```
src/
  domain/        pure logic: units, money (big.js), freshness, comparison, search, schemas
  planner/       meal planning, price estimates, shopping-list maths, device storage
  data/          repository interface, demo + Supabase implementations, reference catalogue
  map/           map adapter (Leaflet) — swap providers here only
  platform/      platform adapter (storage, geolocation) for web / Capacitor
  auth/          Supabase auth provider, safe redirect validation
  i18n/          en / fr / ar dictionaries
  components/    UI building blocks
  pages/         routes
supabase/
  migrations/    schema, trusted functions, RLS
  functions/     submit-report edge function
  seed.sql       reference data (generated)      demo_seed.sql  synthetic demo data (generated)
scripts/         seed generator, CSV import, secret check, static server for E2E
tests/db/        PGlite access-control and import tests
tests/e2e/       Playwright visitor journey
docs/            deployment, security, data, planner, import, Capacitor
```

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Supabase + Vercel setup
- [docs/SECURITY.md](docs/SECURITY.md): controls, tests, known gaps
- [docs/DATA.md](docs/DATA.md): data model, units, freshness, comparison policy, demo data
- [docs/PLANNER.md](docs/PLANNER.md): how the meal planner works
- [docs/DATA_IMPORT.md](docs/DATA_IMPORT.md): importing verified shops and genuine prices
- [docs/CAPACITOR.md](docs/CAPACITOR.md): Android/iOS packaging path
- [docs/DEMO.md](docs/DEMO.md): demo script for the competition

## Known limitations

- No genuine observations or verified shop locations are included. The founder must collect and import them.
- The Supabase backend, the Edge Function and the Vercel deployment have not been run against a live project from this repository yet.
- Database tests run against the real migrations in PGlite with a Supabase-compatible `auth` shim, not against a live Supabase instance.
- Evidence photo uploads are not implemented (by design for the MVP).
- Native Android/iOS builds have not been generated or tested.
- See [docs/SECURITY.md](docs/SECURITY.md#known-gaps) for security limitations.
