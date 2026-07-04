-- Phase 2: statement-style ledger entries (matches the "Individual Valuation
-- Units Ledger" NAV statement format). All values are pre-calculated outside
-- the system and stored verbatim — the app only displays them.
-- Run in Supabase Dashboard -> SQL Editor, same as 0001.

alter table public.investor_vehicle_positions
  add column valuation_date date; -- the "CURRENT VALUE AS OF <date>" date

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.investor_vehicle_positions(id) on delete cascade,
  entry_date date not null,
  transaction_type text not null, -- "Beginning balance", "Deposit", "Gains/losses allocation", ...
  units_change numeric(18,6),
  total_units numeric(18,6),
  paid_in_change numeric(18,2),
  total_paid_in numeric(18,2),
  gain_loss_change numeric(18,2),
  total_gain_loss numeric(18,2),
  capital_change numeric(18,2),
  total_capital numeric(18,2),
  nav_per_unit numeric(18,6),
  remarks text,
  sort_order int not null default 0, -- preserves statement row order
  synced_at timestamptz not null default now()
);
create index ledger_entries_position_idx on public.ledger_entries(position_id);

alter table public.ledger_entries enable row level security;

create policy "investor_sees_own_ledger" on public.ledger_entries
  for select using (
    public.current_role() = 'investor'
    and position_id in (
      select id from public.investor_vehicle_positions
      where investor_id = public.current_investor_id()
    )
  );
create policy "internal_admin_see_all_ledger" on public.ledger_entries
  for select using (public.current_role() in ('internal', 'admin'));
create policy "only_admin_writes_ledger" on public.ledger_entries
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');
