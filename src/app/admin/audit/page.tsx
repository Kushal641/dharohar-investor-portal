import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ACTION_LABELS: Record<string, string> = {
  login_disabled: "Login disabled",
  login_enabled: "Login enabled",
  login_deleted: "Login deleted",
  access_reset: "Access reset",
  internal_user_created: "Internal user created",
  internal_user_disabled: "Internal user disabled",
  internal_user_enabled: "Internal user enabled",
  internal_user_deleted: "Internal user deleted",
  internal_user_password_reset: "Internal user password reset",
};

export default async function AdminAuditPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">Access &amp; audit log</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Every account created, disabled, or modified through the portal (SOP §12.2). Logins
        authorized automatically by the data sync are recorded in the{" "}
        <Link href="/admin/sync" className="text-[#f4511e] hover:text-[#d8430f]">
          sync history
        </Link>
        .
      </p>

      <div className="mt-6 overflow-x-auto rounded-md border border-zinc-100">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">By</th>
              <th className="px-4 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((entry) => (
              <tr key={entry.id} className="border-b border-zinc-50">
                <td className="whitespace-nowrap px-4 py-2.5 text-zinc-600">
                  {new Date(entry.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-2.5 text-zinc-900">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </td>
                <td className="px-4 py-2.5 text-zinc-600">{entry.target_email ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-600">{entry.actor_email ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-600">{entry.reason ?? "—"}</td>
              </tr>
            ))}
            {!entries?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-400">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
