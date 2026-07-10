-- SOP v1.1 §12.2: log of every account created, disabled, or modified,
-- with date and reason. Written server-side (service role); admin-only reads.
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null, -- e.g. 'login_disabled', 'access_reset', 'internal_user_created'
  target_type text not null, -- 'investor_login' | 'internal_user'
  target_email text,
  reason text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "admin_reads_audit_log" on public.admin_audit_log
  for select using (public.current_role() = 'admin');
-- No insert/update/delete policies: rows are written only via the
-- service-role client and are immutable from the app's perspective.
