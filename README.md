# As3ari (أسعاري)
Never overpay for basic food.
The same groceries can cost different amounts at different shops. As3ari helps people discover those differences before they spend their money.
As3ari is a community-driven grocery price platform. People can discover local prices and contribute price reports, turning information that usually stays with one shopper into something the whole community can use. Ratings, report verification, and transparency help people judge how trustworthy that information is.
Finding cheaper groceries is only the beginning. As3ari aims to help households plan affordable, nutritious weekly meals, make better use of limited budgets, and discover unexpected sources of fresh produce from neighborhood markets and roadside sellers.
The vision is simple: give people better information, and give them more control over their money.
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

## License & Ownership

Private project (Beta). All rights reserved. Owned by Fares Nabil Damene.
