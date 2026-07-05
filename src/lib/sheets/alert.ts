import "server-only";
import { Resend } from "resend";
import type { SyncResult } from "./sync";

// Emails the admin when a sync doesn't fully succeed. No-op until
// RESEND_API_KEY / ADMIN_ALERT_EMAIL are configured.
export async function sendSyncAlert(result: SyncResult) {
  if (result.status === "success") return;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!apiKey || !to) return;

  const issueLines = result.issues
    .slice(0, 20)
    .map((i) => `- Row ${i.sheet_row_number ?? "?"}: [${i.issue_type}] ${i.message}`)
    .join("\n");

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.ALERT_FROM_EMAIL ?? "portal@dharoharcapital.in",
    to,
    subject: `Investor portal sync ${result.status === "failed" ? "FAILED" : "completed with issues"}`,
    text: `Sync run ${result.runId}

Status: ${result.status}
Rows read: ${result.rowsRead}
Rows upserted: ${result.rowsUpserted}
Rows skipped: ${result.rowsSkipped}

Issues:
${issueLines || "(none recorded)"}

Full details: https://portal.dharoharcapital.in/admin/sync`,
  });
}
