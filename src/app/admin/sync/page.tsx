import { createClient } from "@/lib/supabase/server";
import { sheetsConfigured } from "@/lib/sheets/client";
import { isReadOnlyViewer } from "@/lib/admin/guard";
import { syncNow } from "./actions";
import { SyncButton, SyncRunningBanner } from "@/components/sync-progress";

const STATUS_STYLES: Record<string, string> = {
  success: "bg-green-50 text-green-700",
  partial_failure: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  running: "bg-blue-50 text-blue-700",
};

function formatTimestamp(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminSyncPage() {
  const supabase = await createClient();
  const configured = sheetsConfigured();
  const readOnly = await isReadOnlyViewer();

  const { data: runs } = await supabase
    .from("sync_runs")
    .select("*, sync_run_issues(id, sheet_row_number, issue_type, message)")
    .order("started_at", { ascending: false })
    .limit(20);

  const latest = runs?.[0];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Monthly data sync</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pulls the master Google Sheet (tabs &quot;AIGF vs Al Maha&quot; and
            &quot;Accounts&quot;) and updates the portal, authorizing any new logins found in the
            Primary Email / Secondary Email columns. Runs automatically on the 1st of each month;
            use the button for an immediate refresh.
          </p>
        </div>
        {!readOnly && (
          <form action={syncNow}>
            <SyncButton disabled={!configured} />
          </form>
        )}
      </div>

      {!configured && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Google Sheets isn&apos;t connected yet — the service account credentials and Sheet ID
          still need to be added to the server configuration. Data shown in the portal is
          currently from the manually loaded statement.
        </p>
      )}

      {latest?.status === "running" && <SyncRunningBanner startedAt={latest.started_at} />}

      {latest && latest.status !== "success" && latest.status !== "running" && (
        <p className={`mt-4 rounded-md px-3 py-2 text-sm ${STATUS_STYLES[latest.status]}`}>
          Latest sync ({formatTimestamp(latest.started_at)}):{" "}
          {latest.status === "failed"
            ? `failed — ${latest.error_summary ?? "unknown error"}`
            : `completed with issues — ${latest.error_summary}`}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {(runs ?? []).map((run) => (
          <details key={run.id} className="rounded-md border border-zinc-100 p-4">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-zinc-800">
                {formatTimestamp(run.started_at)}{" "}
                <span className="text-xs text-zinc-500">({run.triggered_by})</span>
              </span>
              <span className="flex items-center gap-3 text-xs text-zinc-500">
                {run.rows_read !== null && (
                  <span>
                    {run.rows_upserted}/{run.rows_read} rows loaded
                    {run.rows_skipped ? `, ${run.rows_skipped} skipped` : ""}
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 ${STATUS_STYLES[run.status] ?? ""}`}>
                  {run.status.replace("_", " ")}
                </span>
              </span>
            </summary>
            <div className="mt-3 border-t border-zinc-100 pt-3 text-sm">
              {run.error_summary && <p className="text-zinc-600">{run.error_summary}</p>}
              {run.sync_run_issues?.length ? (
                <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                  {run.sync_run_issues.map(
                    (issue: { id: string; sheet_row_number: number | null; issue_type: string; message: string }) => (
                      <li key={issue.id}>
                        <span className="font-medium">
                          Row {issue.sheet_row_number ?? "?"} [{issue.issue_type}]:
                        </span>{" "}
                        {issue.message}
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-zinc-400">No row issues recorded.</p>
              )}
            </div>
          </details>
        ))}
        {!runs?.length && (
          <p className="rounded-md border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-400">
            No syncs have run yet.
          </p>
        )}
      </div>
    </div>
  );
}
