-- Two foreign keys to auth.users(id) were left without an ON DELETE rule,
-- which defaults to Postgres BLOCKING the deletion of any user still
-- referenced by them. In practice this silently broke "Delete" on the
-- Team/Investors pages for any account that had ever triggered a sync
-- (sync_runs.triggered_by_user) or created another account
-- (user_profiles.created_by) — admin.auth.admin.deleteUser() would fail,
-- but the app wasn't checking that error, so the UI showed "deleted"
-- while the row silently remained. Both should just null out on delete —
-- the audit trail (admin_audit_log) is what's meant to preserve history,
-- not these operational reference columns.

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.sync_runs'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) ilike '%triggered_by_user%';
  if cname is not null then
    execute format('alter table public.sync_runs drop constraint %I', cname);
  end if;
end $$;

alter table public.sync_runs
  add constraint sync_runs_triggered_by_user_fkey
  foreign key (triggered_by_user) references auth.users(id) on delete set null;

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.user_profiles'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) ilike '%created_by%';
  if cname is not null then
    execute format('alter table public.user_profiles drop constraint %I', cname);
  end if;
end $$;

alter table public.user_profiles
  add constraint user_profiles_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
