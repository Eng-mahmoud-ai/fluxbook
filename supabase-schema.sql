-- ============================================================
--  Fluxbook — Supabase schema (WITH LOGIN / per-user privacy)
--  Run this in Supabase → SQL Editor → New query → Run.
--  WARNING: this drops the existing tables and their data.
-- ============================================================

drop table if exists transactions cascade;
drop table if exists categories   cascade;
drop table if exists installments cascade;
drop table if exists settings     cascade;

create table transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  txn_date    date not null default now(),
  description text not null,
  category    text,
  amount      numeric not null,
  direction   text not null check (direction in ('in','out')),
  status      text not null default 'Completed',
  created_at  timestamptz not null default now()
);

create table categories (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name    text not null,
  unique (user_id, name)
);

create table installments (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label   text not null,
  total   numeric not null default 0,
  paid    numeric not null default 0,
  monthly numeric not null default 0
);

create table settings (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  balance_base numeric not null default 0
);

-- Row Level Security: each person can only see and edit their OWN rows.
alter table transactions enable row level security;
alter table categories   enable row level security;
alter table installments enable row level security;
alter table settings     enable row level security;

create policy "own rows" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on categories   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on installments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on settings     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
