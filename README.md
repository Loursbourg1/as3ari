# As3ari (أسعاري)

Grocery prices on the ground in Algeria, then a week of meals that actually fits the cash you have.

The same oil, chicken, or vegetables can cost 20–50% more two markets down the road. Households on a fixed wage find that out after the cart is full, run short before the month ends, and fill the gap with cheap starch instead of protein.

Shoppers log the shelf price where they stand. Moderators check each report before it is public. From those prices As3ari builds a 7-day menu for the household size and DZD cap you set, then one shopping list with a running total — so you spend the plan, not the leftover at the till.

## Table of contents

- [Quick start](#quick-start)
- [What’s included](#whats-included)
- [Scripts](#scripts)
- [Stack](#stack)
- [Moderation](#moderation)
- [License](#license)

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

```bash
npm run typecheck
npm test
npm run build
```

Apply database migrations from `supabase/migrations/` with the Supabase CLI.

## What’s included

```text
as3ari/
├── src/                 React app (pages, auth, i18n, planner)
├── supabase/
│   ├── migrations/      PostgreSQL schema, RPCs, RLS
│   └── functions/       Edge functions (report submit, Gemini proxy)
├── tests/               Unit, database, and e2e tests
├── docs/                Deployment, data import, security
└── public/              Static assets
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Vite server |
| `npm test` | Unit tests |
| `npm run test:db` | Migration tests (PGlite) |
| `npm run test:e2e` | Playwright |
| `npm run build` | Production build |

## Stack

React 19, TypeScript, Vite, Tailwind. Supabase (Postgres, Auth, RLS). Optional Gemini proxy for meal plans. PWA and Arabic RTL.

## Moderation

Community reports are stored as `pending` until an `admin` or `moderator` in `user_roles` reviews them at `/moderate`. Only `approved` prices are public.

## License

Private project. All rights reserved.
