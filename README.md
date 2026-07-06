# Fluxbook — Cash Flow Dashboard

A single-page cash-flow app for small business owners. Tracks transactions, installments
(house, car, land, etc.), a running balance, category management, an Excel export, and a
6-month Cash-in vs Cash-out chart. Data is stored in **Supabase** and the app deploys to **Netlify**.

## 1. Set up Supabase

1. Create a project at https://supabase.com.
2. Open **SQL Editor → New query**, paste the contents of `supabase-schema.sql`, and **Run**.
   This creates the `transactions`, `categories`, `installments`, and `settings` tables.
3. Go to **Project Settings → API** and copy your **Project URL** and **anon public key**.

> The schema uses permissive policies so the app works with the public anon key.
> That means anyone with your URL + anon key can read/write this data — fine for a
> personal tool. For a private multi-user app, add Supabase Auth and scope the
> policies to `auth.uid()`.

## 2. Run locally

```bash
npm install
cp .env.example .env      # then paste your Supabase URL + anon key into .env
npm run dev
```

Open the printed localhost URL.

## 3. Deploy to Netlify

**Option A — Git (recommended):** push this folder to GitHub/GitLab, then in Netlify
**Add new site → Import an existing project**, pick the repo. Netlify reads `netlify.toml`
(build `npm run build`, publish `dist`).

**Option B — Drag & drop:** run `npm run build`, then drag the generated `dist/` folder
onto https://app.netlify.com/drop.

**Set the environment variables** in Netlify → **Site settings → Environment variables**:

| Key                       | Value                         |
|---------------------------|-------------------------------|
| `VITE_SUPABASE_URL`       | your Supabase project URL     |
| `VITE_SUPABASE_ANON_KEY`  | your Supabase anon public key |

Redeploy after adding them (env vars are baked in at build time).

## Notes
- **Excel export** produces `fluxbook-cashflow.xlsx` with a *Summary* sheet and a
  *Transactions* sheet (Date, Description, Category, Direction, Amount, Status).
- **Categories** you add in Settings power the category picker on transactions.
- **Installments** each show remaining balance + progress and a *Record payment* button
  that also logs a cash-out transaction.
