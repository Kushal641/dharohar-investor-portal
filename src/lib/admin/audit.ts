import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Fire-and-forget audit write (SOP §12.2). Failures are logged but never
// block the underlying admin action.
export async function recordAudit(entry: {
  actorUserId: string;
  actorEmail?: string | null;
  action: string;
  targetType: "investor_login" | "internal_user";
  targetEmail?: string | null;
  reason?: string | null;
  details?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_audit_log").insert({
    actor_user_id: entry.actorUserId,
    actor_email: entry.actorEmail ?? null,
    action: entry.action,
    target_type: entry.targetType,
    target_email: entry.targetEmail ?? null,
    reason: entry.reason?.trim() || null,
    details: entry.details ?? null,
  });
  if (error) console.error("audit log write failed:", error.message);
}

export async function emailForAuthUser(authUserId: string) {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(authUserId);
  return data.user?.email ?? null;
}
