-- The "internal" role is retired — just investor / admin / founder now.
-- Any existing internal-role account is converted to founder (closest
-- equivalent: read-only, sees everything) rather than left in a role the
-- app no longer recognizes or lets anyone log in as.

update public.user_profiles set role = 'founder' where role = 'internal';

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
  add constraint user_profiles_role_check check (role in ('investor', 'admin', 'founder'));

alter policy "authenticated_read_referral_sources" on public.referral_sources
  using (public.current_role() in ('investor', 'admin', 'founder'));

alter policy "authenticated_read_vehicles" on public.investment_vehicles
  using (public.current_role() in ('investor', 'admin', 'founder'));

alter policy "internal_and_admin_see_all_investors" on public.investors
  using (public.current_role() in ('admin', 'founder'));

alter policy "internal_and_admin_see_all_links" on public.investor_auth_links
  using (public.current_role() in ('admin', 'founder'));

alter policy "internal_admin_see_all_positions" on public.investor_vehicle_positions
  using (public.current_role() in ('admin', 'founder'));

alter policy "internal_admin_see_all_contributions" on public.contributions
  using (public.current_role() in ('admin', 'founder'));

alter policy "internal_admin_see_all_ledger" on public.ledger_entries
  using (public.current_role() in ('admin', 'founder'));
