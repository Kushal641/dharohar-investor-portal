import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSheetTab, sheetsConfigured } from "./client";

// ============================================================
// Expected Google Sheet layout (two tabs). Header row required;
// column order doesn't matter, headers are matched by name
// (case-insensitive, ignoring spaces/slashes).
//
// Tab "Investors":
//   Investor ID | Full Name | Email | Referral Source | Date of First Investment
//
// Tab "Ledger" (one row per statement line, grouped by investor+vehicle):
//   Investor ID | Investment Vehicle | Date | Transaction |
//   Units Change | Total Units | Paid In Change | Total Paid In |
//   Gain/Loss Change | Total Gain/Loss | Capital Change | Total Capital |
//   NAV per Unit | Remarks
//
// Principle: upload -> map -> display. Values are stored verbatim; the
// position's "current value" is the LAST ledger row's Total Capital.
// Dates: use YYYY-MM-DD or "May 01, 2026" format (not DD/MM/YYYY — ambiguous).
// ============================================================

type Issue = { sheet_row_number: number | null; issue_type: string; message: string; raw_row_data?: unknown };

export type SyncResult = {
  runId: string;
  status: "success" | "partial_failure" | "failed";
  rowsRead: number;
  rowsUpserted: number;
  rowsSkipped: number;
  issues: Issue[];
};

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z]/g, "");
}

function indexHeaders(headerRow: string[]) {
  const map = new Map<string, number>();
  headerRow.forEach((h, i) => map.set(normalizeHeader(h), i));
  return (name: string) => map.get(normalizeHeader(name));
}

function parseNumber(raw: string | undefined): number | null | "invalid" {
  if (raw === undefined || raw.trim() === "") return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : "invalid";
}

function parseDate(raw: string | undefined): string | null | "invalid" {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // "May 01, 2026" and similar unambiguous formats
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime()) && /[a-zA-Z]/.test(trimmed)) {
    return parsed.toISOString().slice(0, 10);
  }
  return "invalid";
}

export async function runSync(
  triggeredBy: "manual" | "scheduled",
  triggeredByUser?: string,
): Promise<SyncResult> {
  const admin = createAdminClient();

  const { data: run, error: runError } = await admin
    .from("sync_runs")
    .insert({ triggered_by: triggeredBy, triggered_by_user: triggeredByUser ?? null })
    .select("id")
    .single();
  if (runError || !run) throw new Error(`could not create sync run: ${runError?.message}`);
  const runId = run.id;

  const issues: Issue[] = [];
  let rowsRead = 0;
  let rowsUpserted = 0;
  let rowsSkipped = 0;

  async function finish(status: SyncResult["status"], errorSummary?: string): Promise<SyncResult> {
    if (issues.length) {
      await admin.from("sync_run_issues").insert(
        issues.map((i) => ({
          sync_run_id: runId,
          sheet_row_number: i.sheet_row_number,
          issue_type: i.issue_type,
          message: i.message,
          raw_row_data: i.raw_row_data ?? null,
        })),
      );
    }
    await admin
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        rows_read: rowsRead,
        rows_upserted: rowsUpserted,
        rows_skipped: rowsSkipped,
        error_summary: errorSummary ?? (issues.length ? `${issues.length} row issue(s)` : null),
      })
      .eq("id", runId);
    return { runId, status, rowsRead, rowsUpserted, rowsSkipped, issues };
  }

  if (!sheetsConfigured()) {
    return finish(
      "failed",
      "Google Sheets is not configured yet (missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / GOOGLE_SHEET_ID).",
    );
  }

  let investorRows: string[][];
  let ledgerRows: string[][];
  try {
    [investorRows, ledgerRows] = await Promise.all([
      readSheetTab("Investors"),
      readSheetTab("Ledger"),
    ]);
  } catch (err) {
    return finish("failed", `Could not read the Google Sheet: ${(err as Error).message}`);
  }

  if (!investorRows.length || !ledgerRows.length) {
    return finish("failed", "Sheet tabs 'Investors' and/or 'Ledger' are empty or missing.");
  }

  // ---------- Investors tab ----------
  const invCol = indexHeaders(investorRows[0]);
  const investorIdsInSheet = new Map<string, string>(); // code -> db id

  for (let r = 1; r < investorRows.length; r++) {
    const row = investorRows[r];
    rowsRead++;
    const sheetRowNumber = r + 1;
    const code = (row[invCol("Investor ID") ?? -1] ?? "").trim();
    const fullName = (row[invCol("Full Name") ?? -1] ?? "").trim();
    if (!code) {
      rowsSkipped++;
      issues.push({ sheet_row_number: sheetRowNumber, issue_type: "missing_investor_id", message: "Investors tab row has no Investor ID", raw_row_data: row });
      continue;
    }
    if (!fullName) {
      rowsSkipped++;
      issues.push({ sheet_row_number: sheetRowNumber, issue_type: "missing_name", message: `Investor ${code} has no Full Name`, raw_row_data: row });
      continue;
    }

    const firstInvestment = parseDate(row[invCol("Date of First Investment") ?? -1]);
    if (firstInvestment === "invalid") {
      issues.push({ sheet_row_number: sheetRowNumber, issue_type: "bad_date", message: `Investor ${code}: unreadable Date of First Investment — field left unchanged`, raw_row_data: row });
    }

    let referralSourceId: string | null = null;
    const referralName = (row[invCol("Referral Source") ?? -1] ?? "").trim();
    if (referralName) {
      const { data: ref } = await admin
        .from("referral_sources")
        .upsert({ name: referralName }, { onConflict: "name" })
        .select("id")
        .single();
      referralSourceId = ref?.id ?? null;
    }

    // New investors get a data record but NO login — the admin grants portal
    // access deliberately (a sheet typo must never create a live account).
    const { data: investor, error } = await admin
      .from("investors")
      .upsert(
        {
          investor_code: code,
          full_name: fullName,
          email: (row[invCol("Email") ?? -1] ?? "").trim() || null,
          referral_source_id: referralSourceId,
          ...(firstInvestment && firstInvestment !== "invalid"
            ? { date_of_first_investment: firstInvestment }
            : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "investor_code" },
      )
      .select("id")
      .single();

    if (error || !investor) {
      rowsSkipped++;
      issues.push({ sheet_row_number: sheetRowNumber, issue_type: "upsert_failed", message: `Investor ${code}: ${error?.message}`, raw_row_data: row });
      continue;
    }
    investorIdsInSheet.set(code, investor.id);
    rowsUpserted++;
  }

  // ---------- Ledger tab ----------
  const ledCol = indexHeaders(ledgerRows[0]);
  type LedgerRow = { sheetRowNumber: number; raw: string[] };
  const groups = new Map<string, LedgerRow[]>(); // "code||vehicle" -> rows in sheet order

  for (let r = 1; r < ledgerRows.length; r++) {
    const row = ledgerRows[r];
    rowsRead++;
    const code = (row[ledCol("Investor ID") ?? -1] ?? "").trim();
    const vehicle = (row[ledCol("Investment Vehicle") ?? -1] ?? "").trim();
    if (!code || !vehicle) {
      rowsSkipped++;
      issues.push({ sheet_row_number: r + 1, issue_type: "missing_key", message: "Ledger row missing Investor ID or Investment Vehicle", raw_row_data: row });
      continue;
    }
    const key = `${code}||${vehicle}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ sheetRowNumber: r + 1, raw: row });
  }

  const vehicleIds = new Map<string, string>();

  for (const [key, rows] of groups) {
    const [code, vehicleName] = key.split("||");

    let investorId = investorIdsInSheet.get(code);
    if (!investorId) {
      const { data: existing } = await admin
        .from("investors")
        .select("id")
        .eq("investor_code", code)
        .maybeSingle();
      if (!existing) {
        rowsSkipped += rows.length;
        issues.push({ sheet_row_number: rows[0].sheetRowNumber, issue_type: "unknown_investor_code", message: `Ledger references Investor ID "${code}" which is not in the Investors tab or database — ${rows.length} row(s) skipped` });
        continue;
      }
      investorId = existing.id;
    }

    let vehicleId = vehicleIds.get(vehicleName);
    if (!vehicleId) {
      const { data: existingVehicle } = await admin
        .from("investment_vehicles")
        .select("id")
        .eq("name", vehicleName)
        .maybeSingle();
      if (existingVehicle) {
        vehicleId = existingVehicle.id as string;
      } else {
        const { data: newVehicle, error } = await admin
          .from("investment_vehicles")
          .insert({ name: vehicleName })
          .select("id")
          .single();
        if (error || !newVehicle) {
          rowsSkipped += rows.length;
          issues.push({ sheet_row_number: rows[0].sheetRowNumber, issue_type: "vehicle_create_failed", message: `Could not create vehicle "${vehicleName}": ${error?.message}` });
          continue;
        }
        vehicleId = newVehicle.id as string;
        issues.push({ sheet_row_number: rows[0].sheetRowNumber, issue_type: "new_vehicle_created", message: `New investment vehicle "${vehicleName}" was created from the sheet — verify the name is not a typo` });
      }
      vehicleIds.set(vehicleName, vehicleId);
    }

    // Parse all rows of the group first — a bad row skips just that row.
    const parsed: { entry: Record<string, unknown>; sheetRowNumber: number }[] = [];
    for (const { raw, sheetRowNumber } of rows) {
      const entryDate = parseDate(raw[ledCol("Date") ?? -1]);
      if (!entryDate || entryDate === "invalid") {
        rowsSkipped++;
        issues.push({ sheet_row_number: sheetRowNumber, issue_type: "bad_date", message: `Unreadable Date — row skipped`, raw_row_data: raw });
        continue;
      }
      const numbers: Record<string, number | null> = {};
      let bad = false;
      for (const [field, header] of [
        ["units_change", "Units Change"],
        ["total_units", "Total Units"],
        ["paid_in_change", "Paid In Change"],
        ["total_paid_in", "Total Paid In"],
        ["gain_loss_change", "Gain/Loss Change"],
        ["total_gain_loss", "Total Gain/Loss"],
        ["capital_change", "Capital Change"],
        ["total_capital", "Total Capital"],
        ["nav_per_unit", "NAV per Unit"],
      ] as const) {
        const value = parseNumber(raw[ledCol(header) ?? -1]);
        if (value === "invalid") {
          issues.push({ sheet_row_number: sheetRowNumber, issue_type: "bad_number", message: `Unreadable number in "${header}" — row skipped`, raw_row_data: raw });
          bad = true;
          break;
        }
        numbers[field] = value;
      }
      if (bad) {
        rowsSkipped++;
        continue;
      }
      parsed.push({
        sheetRowNumber,
        entry: {
          entry_date: entryDate,
          transaction_type: (raw[ledCol("Transaction") ?? -1] ?? "").trim() || "—",
          remarks: (raw[ledCol("Remarks") ?? -1] ?? "").trim() || null,
          source_sheet_row: sheetRowNumber,
          ...numbers,
        },
      });
    }

    if (!parsed.length) continue;

    const first = parsed[0].entry as { nav_per_unit: number | null };
    const last = parsed[parsed.length - 1].entry as {
      nav_per_unit: number | null;
      total_capital: number | null;
      entry_date: string;
    };

    const { data: position, error: posError } = await admin
      .from("investor_vehicle_positions")
      .upsert(
        {
          investor_id: investorId,
          vehicle_id: vehicleId,
          nav_at_allocation: first.nav_per_unit,
          latest_nav: last.nav_per_unit,
          current_valuation: last.total_capital, // last row's Total Capital IS the current value
          valuation_date: last.entry_date,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "investor_id,vehicle_id" },
      )
      .select("id")
      .single();

    if (posError || !position) {
      rowsSkipped += parsed.length;
      issues.push({ sheet_row_number: parsed[0].sheetRowNumber, issue_type: "position_failed", message: `Position for ${code} / ${vehicleName}: ${posError?.message}` });
      continue;
    }

    // The sheet is the source of truth: rebuild this position's ledger.
    await admin.from("ledger_entries").delete().eq("position_id", position.id);
    const { error: insertError } = await admin.from("ledger_entries").insert(
      parsed.map((p, i) => ({ ...p.entry, position_id: position.id, sort_order: i + 1 })),
    );
    if (insertError) {
      rowsSkipped += parsed.length;
      issues.push({ sheet_row_number: parsed[0].sheetRowNumber, issue_type: "ledger_insert_failed", message: `${code} / ${vehicleName}: ${insertError.message}` });
      continue;
    }
    rowsUpserted += parsed.length;
  }

  const hasBlockingIssues = issues.some((i) => i.issue_type !== "new_vehicle_created");
  return finish(hasBlockingIssues ? "partial_failure" : "success");
}
