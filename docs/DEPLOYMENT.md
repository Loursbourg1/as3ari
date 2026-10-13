# Deployment: Supabase + Vercel

Everything below uses **your** accounts. Never paste secrets into chat or commit them.
The browser only ever needs the project URL and the **anon/publishable** key.

## 1. Supabase project

1. Create a project at <https://supabase.com/dashboard> (choose the region closest to Algeria, e.g. Frankfurt).
2. In a terminal in this repo:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push            # applies supabase/migrations/*
   ```

3. Load reference data: open **SQL Editor** → paste `supabase/seed.sql` → Run.
4. *(Optional, for the demo)* paste `supabase/demo_seed.sql` → Run. These rows are marked demo.
   To remove them later:

   ```sql
   delete from public.price_reports where source = 'demo';
   delete from public.shops where provenance = 'demo';
   ```

   Demo dates are relative to the day you run the file; re-run it (after deleting) to refresh them.

## 2. Auth settings (Dashboard → Authentication)

- **Email** provider enabled, **Confirm email = ON** (contributions require a verified email; the database enforces it too).
- **URL Configuration**
  - Site URL: `https://<your-app>.vercel.app`
  - Redirect URLs: `https://<your-app>.vercel.app/auth/callback**` and `http://localhost:5173/auth/callback**`
- **Password policy**: minimum length 10, require lower/upper case and digits (matches `supabase/config.toml`).
- **Rate limits**: keep the defaults or lower them. Consider enabling **CAPTCHA** (Turnstile/hCaptcha) for sign-ups.
  If you do, add its domains to the CSP in `vercel.json`.
- Configure a custom SMTP sender before real users sign up (the built-in sender is heavily rate-limited).

## 3. Edge Function

```bash
npx supabase functions deploy submit-report
npx supabase secrets set ALLOWED_ORIGINS=https://<your-app>.vercel.app,http://localhost:5173
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided to functions automatically. The function
does **not** use the service-role key. If you would rather not deploy it yet, set
`VITE_SUBMIT_VIA=rpc` in Vercel: the browser then calls the same database function directly
(all validation still happens in the database).

## 4. First administrator

Sign up in the app with your own email and confirm it, then in the SQL Editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

Roles can only be granted this way. There is no API path that grants them.

## 5. Vercel

1. Push this repository to GitHub (private or public, without `.env*` files).
2. <https://vercel.com/new> → import the repo. Framework preset: **Vite** (also set in `vercel.json`).
3. Environment variables (Production + Preview):

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the anon / publishable key |
   | `VITE_SHOW_DEMO_DATA` | `true` for the demo, `false` once genuine data exists |
   | `VITE_MAP_TILE_URL` *(optional)* | tile URL of a keyed provider for production traffic |

4. Deploy. Alternatively from the terminal: `npx vercel` then `npx vercel --prod`.

If you change the tile provider, add its host to `img-src` in the `Content-Security-Policy`
in `vercel.json`.

## 6. Verify the live site

- Open the site in a private window: map, search, comparison, planner and lists work without an account.
- Click **Report a price**: you are sent to sign-in; after signing in with a confirmed email the form appears.
- Submit a report: status shows **Pending review**; it does **not** appear on the map until an admin approves it at `/moderate`.
- Run the live E2E suite against it:

  ```bash
  E2E_BASE_URL=https://<your-app>.vercel.app E2E_EMAIL=<verified test user> E2E_PASSWORD=<password> npx playwright test
  ```

  Use a dedicated test account, never your admin account.
