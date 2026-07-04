-- Dharohar Capital Partners — Investor Portal
-- Phase 1: core schema + Row Level Security
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.

-- ============================================================
-- ROLES / PROFILES
-- ============================================================
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('investor', 'internal', 'admin')),
  display_name text not null,
  is_disabled boolean not null default false,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- ============================================================
-- REFERRAL SOURCES (lookup list, keeps the internal-dashboard filter clean)
-- ============================================================
create table public.referral_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- ============================================================
-- INVESTORS (the real entity — decoupled from auth users)
-- ============================================================
create table public.investors (
  id uuid primary key default gen_random_uuid(),
  investor_code text not null unique, -- human-facing "User ID", e.g. "DCP-0042"
  full_name text not null,
  email text,
  referral_source_id uuid references public.referral_sources(id),
  date_of_first_investment date,
  notes text, -- admin-only internal notes
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Joint accounts: many auth users -> one investor.
create table public.investor_auth_links (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  label text, -- e.g. "Primary holder", "Joint holder" — display only
  created_at timestamptz not null default now(),
  unique (auth_user_id) -- one login maps to exactly one investor
);
create index investor_auth_links_investor_id_idx on public.investor_auth_links(investor_id);

-- ============================================================
-- INVESTMENT VEHICLES
-- ============================================================
create table public.investment_vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- "Ananta India Growth Fund", "Almaha", etc.
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- POSITIONS (one row per investor+vehicle) and CONTRIBUTIONS (top-ups)
-- ============================================================
create table public.investor_vehicle_positions (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  vehicle_id uuid not null references public.investment_vehicles(id),
  nav_at_allocation numeric(18,4),
  latest_nav numeric(18,4),
  current_valuation numeric(18,2), -- copied from the sheet, never computed in-app
  units_held numeric(18,4),
  last_synced_at timestamptz,
  sheet_row_ref text,
  unique (investor_id, vehicle_id)
);
create index positions_investor_id_idx on public.investor_vehicle_positions(investor_id);
create index positions_vehicle_id_idx on public.investor_vehicle_positions(vehicle_id);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.investor_vehicle_positions(id) on delete cascade,
  contribution_date date not null,
  amount numeric(18,2) not null,
  nav_at_contribution numeric(18,4),
  source_sheet_row int,
  synced_at timestamptz not null default now(),
  unique (position_id, contribution_date, amount) -- natural key, keeps re-sync idempotent
);
create index contributions_position_id_idx on public.contributions(position_id);

-- ============================================================
-- SYNC LOG / STATUS (used from Phase 4 onward)
-- ============================================================
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  triggered_by text not null check (triggered_by in ('manual', 'scheduled')),
  triggered_by_user uuid references auth.users(id),
  status text not null default 'running' check (status in ('running', 'success', 'partial_failure', 'failed')),
  rows_read int,
  rows_upserted int,
  rows_skipped int,
  error_summary text
);

create table public.sync_run_issues (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.sync_runs(id) on delete cascade,
  sheet_row_number int,
  issue_type text not null,
  raw_row_data jsonb,
  message text
);

-- ============================================================
-- HELPER FUNCTIONS (used by RLS policies below)
-- ============================================================
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_profiles where id = auth.uid();
$$;

create or replace function public.current_investor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select investor_id from public.investor_auth_links where auth_user_id = auth.uid();
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.user_profiles enable row level security;
alter table public.referral_sources enable row level security;
alter table public.investors enable row level security;
alter table public.investor_auth_links enable row level security;
alter table public.investment_vehicles enable row level security;
alter table public.investor_vehicle_positions enable row level security;
alter table public.contributions enable row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_run_issues enable row level security;

-- USER_PROFILES: everyone can read their own row; only admin manages all rows.
create policy "self_read_profile" on public.user_profiles
  for select using (id = auth.uid());
create policy "admin_manages_profiles" on public.user_profiles
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- REFERRAL_SOURCES: any authenticated app role can read; only admin writes.
create policy "authenticated_read_referral_sources" on public.referral_sources
  for select using (public.current_role() in ('investor', 'internal', 'admin'));
create policy "admin_writes_referral_sources" on public.referral_sources
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- INVESTMENT_VEHICLES: any authenticated app role can read; only admin writes.
create policy "authenticated_read_vehicles" on public.investment_vehicles
  for select using (public.current_role() in ('investor', 'internal', 'admin'));
create policy "admin_writes_vehicles" on public.investment_vehicles
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- INVESTORS
create policy "investor_sees_self" on public.investors
  for select using (
    public.current_role() = 'investor' and id = public.current_investor_id()
  );
create policy "internal_and_admin_see_all_investors" on public.investors
  for select using (public.current_role() in ('internal', 'admin'));
create policy "only_admin_writes_investors" on public.investors
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- INVESTOR_AUTH_LINKS: investor can see their own link row (so the UI can show "joint holder" label);
-- only admin manages links (assigning/removing logins).
create policy "investor_sees_own_link" on public.investor_auth_links
  for select using (auth_user_id = auth.uid());
create policy "internal_and_admin_see_all_links" on public.investor_auth_links
  for select using (public.current_role() in ('internal', 'admin'));
create policy "only_admin_writes_links" on public.investor_auth_links
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- POSITIONS
create policy "investor_sees_own_positions" on public.investor_vehicle_positions
  for select using (
    public.current_role() = 'investor' and investor_id = public.current_investor_id()
  );
create policy "internal_admin_see_all_positions" on public.investor_vehicle_positions
  for select using (public.current_role() in ('internal', 'admin'));
create policy "only_admin_writes_positions" on public.investor_vehicle_positions
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');
  -- Note: the Phase 4 sync job runs server-side with the Supabase service_role key,
  -- which bypasses RLS entirely by design (a trusted server-only credential, never
  -- sent to the browser) — so it does not need its own policy here.

-- CONTRIBUTIONS
create policy "investor_sees_own_contributions" on public.contributions
  for select using (
    public.current_role() = 'investor'
    and position_id in (
      select id from public.investor_vehicle_positions
      where investor_id = public.current_investor_id()
    )
  );
create policy "internal_admin_see_all_contributions" on public.contributions
  for select using (public.current_role() in ('internal', 'admin'));
create policy "only_admin_writes_contributions" on public.contributions
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- SYNC_RUNS / SYNC_RUN_ISSUES: admin only.
create policy "admin_only_sync_runs" on public.sync_runs
  for all using (public.current_role() = 'admin');
create policy "admin_only_sync_run_issues" on public.sync_run_issues
  for all using (public.current_role() = 'admin');
