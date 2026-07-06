-- ============================================================
--  Fluxbook — Supabase schema
--  Run this once in Supabase → SQL Editor → New query → Run.
-- ============================================================

create table if not exists transactions (
  id          uuid primary key default gen_random_uuid(),
  txn_date    date not null default now(),
  description text not null,
  category    text,
  amount      numeric not null,
  direction   text not null check (direction in ('in','out')),
  status      text not null default 'Completed',
  created_at  timestamptz not null default now()
);

create table if not exists categories (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists installments (
  id      uuid primary key default gen_random_uuid(),
  label   text not null,
  total   numeric not null default 0,
  paid    numeric not null default 0,
  monthly numeric not null default 0
);

create table if not exists settings (
  id           int primary key default 1,
  balance_base numeric not null default 0
);

-- ------------------------------------------------------------
--  Access policies
--  This is a personal, single-user app that talks to Supabase
--  with the public "anon" key, so we allow the anon role full
--  access. NOTE: anyone with your URL + anon key could then
--  read/write this data. For a private app, add Supabase Auth
--  and scope these policies to auth.uid() instead.
-- ------------------------------------------------------------
alter table transactions  enable row level security;
alter table categories    enable row level security;
alter table installments  enable row level security;
alter table settings      enable row level security;

drop policy if exists "anon all" on transactions;
drop policy if exists "anon all" on categories;
drop policy if exists "anon all" on installments;
drop policy if exists "anon all" on settings;

create policy "anon all" on transactions  for all using (true) with check (true);
create policy "anon all" on categories    for all using (true) with check (true);
create policy "anon all" on installments  for all using (true) with check (true);
create policy "anon all" on settings      for all using (true) with check (true);

-- Optional: seed one settings row + a starter installment.
insert into settings (id, balance_base) values (1, 842000)
  on conflict (id) do nothing;
