-- Phase 5: "founder" role — same read access as admin across the portal,
-- but never granted any write access. Mutating server actions all funnel
-- through requireAdmin() (src/lib/admin/guard.ts), which still checks for
-- role = 'admin' only, so this migration only needs to extend SELECT policies.
-- Run in Supabase Dashboard -> SQL Editor, same as prior migrations.

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.user_profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%';
  if cname is not null then
    execute format('alter table public.user_profiles drop constraint %I', cname);
  end if;
end $$;

alter table public.user_profiles
  add constraint user_profiles_role_check check (role in ('investor', 'internal', 'admin', 'founder'));

alter policy "authenticated_read_referral_sources" on public.referral_sources
  using (public.current_role() in ('investor', 'internal', 'admin', 'founder'));

alter policy "authenticated_read_vehicles" on public.investment_vehicles
  using (public.current_role() in ('investor', 'internal', 'admin', 'founder'));

alter policy "internal_and_admin_see_all_investors" on public.investors
  using (public.current_role() in ('internal', 'admin', 'founder'));

alter policy "internal_and_admin_see_all_links" on public.investor_auth_links
  using (public.current_role() in ('internal', 'admin', 'founder'));

alter policy "internal_admin_see_all_positions" on public.investor_vehicle_positions
  using (public.current_role() in ('internal', 'admin', 'founder'));

alter policy "internal_admin_see_all_contributions" on public.contributions
  using (public.current_role() in ('internal', 'admin', 'founder'));

alter policy "internal_admin_see_all_ledger" on public.ledger_entries
  using (public.current_role() in ('internal', 'admin', 'founder'));

-- SYNC_RUNS / SYNC_RUN_ISSUES: the existing admin policy is "for all" (read
-- + write) — founder gets its own read-only policy alongside it rather than
-- being added to the admin one, so it can never trigger/modify a sync run.
create policy "founder_reads_sync_runs" on public.sync_runs
  for select using (public.current_role() = 'founder');
create policy "founder_reads_sync_run_issues" on public.sync_run_issues
  for select using (public.current_role() = 'founder');
