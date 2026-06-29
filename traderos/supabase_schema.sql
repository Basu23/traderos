-- ══════════════════════════════════════════════
-- TRADEROS — Supabase Schema
-- Run this once in your Supabase project's SQL Editor
-- (Project → SQL Editor → New Query → paste → Run)
-- ══════════════════════════════════════════════

-- Trades table. TraderOS stores the full trade object as JSONB in `data`,
-- so the table itself stays simple and never needs migrations when you
-- add new trade fields in the app.
create table if not exists trades (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Since this is a single-user app with no auth, allow the anon key
-- full access. Do NOT do this for a multi-user app.
alter table trades enable row level security;

create policy "Allow anon full access to trades"
  on trades
  for all
  using (true)
  with check (true);

-- Helpful index for ordering by recency (already used by DB.syncFromSupabase)
create index if not exists trades_created_at_idx on trades (created_at desc);
