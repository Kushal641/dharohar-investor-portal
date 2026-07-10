import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSheetTab, sheetsConfigured } from "./client";

// ============================================================
// Expected Google Sheet layout (two tabs). Column order doesn't matter —
// headers are matched by name (case-insensitive, ignoring spaces/slashes) —
// but row position does: the header row is found by scanning, not assumed
// to be row 1, since the real sheet has title rows above it.
//
// Tab "AIGF vs Al Maha" (the investor list):
//   S. No. | Name | Fund | Referral | Invested Amount | Current Value
//   "Fund" is "AIGF" or "Al Maha" (mapped to the full vehicle name below,
//   not stored verbatim). Rows stop at the first blank Name — everything
//   below that on the tab is on-sheet summary formulas, not data.
//
// Tab "Accounts" (per-investor NAV ledger — stacked blocks, not one flat
// table): a row with just the investor's name in column A, immediately
// followed by a header row (Date | Transaction | Units Change | Total
// Units | Paid In Change | Total Paid In | Gain/Loss Change | Total
// Gain/Loss | Total Capital Change | Total Capital | NAV per Unit), then
// that investor's ledger rows, until a row whose Date column doesn't parse
// (blank row, or a "CURRENT VALUE AS OF ..." summary line) ends the block.
// Investors with no block (e.g. today, all Al Maha investors) get their
// position from the main tab's Invested Amount / Current Value directly,
// with no ledger detail.
//
// Investors are matched to existing DB rows by normalized name — this
// sheet has no stable per-row ID column. An unmatched name gets a freshly
// minted "DCP-####" code (logged as an info issue so admins notice and can
// sanity-check it wasn't just a name edit, not a genuinely new investor).
//
// There are no email columns on this sheet. Portal logins are never
// touched by this sync — they're provisioned manually via the admin
// "Add login" action (src/app/admin/investors/actions.ts).
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

const MAIN_TAB = "AIGF vs Al Maha";
const ACCOUNTS_TAB = "Accounts";

const FUND_NAMES: Record<string, string> = {
  aigf: "Ananta India Growth Incorporated VCC Sub-Fund 1",
  almaha: "Al Maha Investment Fund PCC - Asia Strategy",
};

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z]/g, "");
}

function indexHeaders(headerRow: string[]) {
  const map = new Map<string, number>();
  headerRow.forEach((h, i) => map.set(normalizeHeader(h), i));
  return (name: string) => map.get(normalizeHeader(name));
}

// Treats "and" and "&" as equivalent, since the same joint-holder name
// appears as "Varsha and Bhuvan Gupta" on the main tab but "Varsha &
// Bhuvan Gupta" in the Accounts tab's block header.
function normalizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+and\s+/g, " & ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s+/g, " ");
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
  // "May 01, 2026" and similar — the WHOLE cell must look like a date, not
  // just contain one (otherwise a summary line like "CURRENT VALUE AS OF
  // MAY 31, 2026" parses too, since new Date() extracts a date from within
  // a longer sentence).
  if (/^[A-Za-z]+\.? \d{1,2},? \d{4}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return "invalid";
}

type InvestorRecord = { id: string; investor_code: string; full_name: string };

type ParsedLedgerEntry = {
  entry_date: string;
  transaction_type: string;
  units_change: number | null;
  total_units: number | null;
  paid_in_change: number | null;
  total_paid_in: number | null;
  gain_loss_change: number | null;
  total_gain_loss: number | null;
  capital_change: number | null;
  total_capital: number | null;
  nav_per_unit: number | null;
};

const LEDGER_NUMBER_FIELDS: [keyof ParsedLedgerEntry, string][] = [
  ["units_change", "Units Change"],
  ["total_units", "Total Units"],
  ["paid_in_change", "Paid In Change"],
  ["total_paid_in", "Total Paid In"],
  ["gain_loss_change", "Gain/Loss Change"],
  ["total_gain_loss", "Total Gain/Loss"],
  ["capital_change", "Total Capital Change"],
  ["total_capital", "Total Capital"],
  ["nav_per_unit", "NAV per Unit"],
];

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

  let mainRows: string[][];
  try {
    mainRows = await readSheetTab(MAIN_TAB);
  } catch (err) {
    return finish("failed", `Could not read the "${MAIN_TAB}" tab: ${(err as Error).message}`);
  }
  if (!mainRows.length) {
    return finish("failed", `Tab "${MAIN_TAB}" is empty or missing.`);
  }

  // ---------- Load existing investors for name matching ----------
  const { data: existingInvestors } = await admin.from("investors").select("id, investor_code, full_name");

  const byNormalizedName = new Map<string, InvestorRecord>();
  let maxCodeSuffix = 0;
  for (const inv of existingInvestors ?? []) {
    byNormalizedName.set(normalizeName(inv.full_name), inv);
    const m = /^DCP-(\d+)$/.exec(inv.investor_code);
    if (m) maxCodeSuffix = Math.max(maxCodeSuffix, parseInt(m[1], 10));
  }
  function nextInvestorCode() {
    maxCodeSuffix += 1;
    return `DCP-${String(maxCodeSuffix).padStart(4, "0")}`;
  }

  // ---------- Main tab: investor list ----------
  const headerIdx = mainRows.findIndex((row) => {
    const col = indexHeaders(row);
    return col("Name") !== undefined && col("Fund") !== undefined;
  });
  if (headerIdx === -1) {
    return finish("failed", `Could not find a header row with "Name" and "Fund" columns in the "${MAIN_TAB}" tab.`);
  }
  const mainCol = indexHeaders(mainRows[headerIdx]);

  type PositionInput = {
    code: string;
    vehicleId: string;
    invested: number | null;
    current: number | null;
    sheetRowNumber: number;
  };
  const positionsByInvestorId = new Map<string, PositionInput>();
  const vehicleIds = new Map<string, string>();

  for (let r = headerIdx + 1; r < mainRows.length; r++) {
    const row = mainRows[r];
    const sheetRowNumber = r + 1;
    const name = (row[mainCol("Name") ?? -1] ?? "").trim();
    if (!name) break; // end of the investor rows — summary blocks follow

    rowsRead++;

    const fundRaw = (row[mainCol("Fund") ?? -1] ?? "").trim();
    const vehicleName = FUND_NAMES[fundRaw.toLowerCase().replace(/[^a-z]/g, "")];
    if (!vehicleName) {
      rowsSkipped++;
      issues.push({ sheet_row_number: sheetRowNumber, issue_type: "unknown_fund", message: `Investor "${name}": unrecognized Fund "${fundRaw}" — row skipped`, raw_row_data: row });
      continue;
    }

    const investedAmount = parseNumber(row[mainCol("Invested Amount") ?? -1]);
    const currentValue = parseNumber(row[mainCol("Current Value") ?? -1]);
    if (investedAmount === "invalid" || currentValue === "invalid") {
      rowsSkipped++;
      issues.push({ sheet_row_number: sheetRowNumber, issue_type: "bad_number", message: `Investor "${name}": unreadable Invested Amount or Current Value — row skipped`, raw_row_data: row });
      continue;
    }

    let referralSourceId: string | null = null;
    const referralName = (row[mainCol("Referral") ?? -1] ?? "").trim();
    if (referralName) {
      const { data: ref } = await admin
        .from("referral_sources")
        .upsert({ name: referralName }, { onConflict: "name" })
        .select("id")
        .single();
      referralSourceId = ref?.id ?? null;
    }

    const normalized = normalizeName(name);
    const existing = byNormalizedName.get(normalized);
    const code = existing?.investor_code ?? nextInvestorCode();

    const { data: investor, error } = await admin
      .from("investors")
      .upsert(
        { investor_code: code, full_name: name, referral_source_id: referralSourceId, updated_at: new Date().toISOString() },
        { onConflict: "investor_code" },
      )
      .select("id")
      .single();

    if (error || !investor) {
      rowsSkipped++;
      issues.push({ sheet_row_number: sheetRowNumber, issue_type: "upsert_failed", message: `Investor "${name}": ${error?.message}`, raw_row_data: row });
      continue;
    }

    if (!existing) {
      issues.push({ sheet_row_number: sheetRowNumber, issue_type: "new_investor_created", message: `New investor "${name}" added as ${code} — verify this isn't just a renamed existing investor` });
    }
    byNormalizedName.set(normalized, { id: investor.id, investor_code: code, full_name: name });
    rowsUpserted++;

    let vehicleId = vehicleIds.get(vehicleName);
    if (!vehicleId) {
      const { data: vehicle, error: vehicleError } = await admin
        .from("investment_vehicles")
        .upsert({ name: vehicleName }, { onConflict: "name" })
        .select("id")
        .single();
      if (vehicleError || !vehicle) {
        rowsSkipped++;
        issues.push({ sheet_row_number: sheetRowNumber, issue_type: "vehicle_upsert_failed", message: `Vehicle "${vehicleName}": ${vehicleError?.message}` });
        continue;
      }
      vehicleId = vehicle.id as string;
      vehicleIds.set(vehicleName, vehicleId);
    }

    positionsByInvestorId.set(investor.id, { code, vehicleId, invested: investedAmount, current: currentValue, sheetRowNumber });
  }

  // ---------- Accounts tab: per-investor NAV ledger blocks ----------
  const ledgerByInvestorId = new Map<string, { entries: ParsedLedgerEntry[]; sheetRowNumber: number }>();

  let accountsRows: string[][] = [];
  try {
    accountsRows = await readSheetTab(ACCOUNTS_TAB);
  } catch (err) {
    issues.push({ sheet_row_number: null, issue_type: "accounts_tab_unreadable", message: `Could not read the "${ACCOUNTS_TAB}" tab — ledger detail skipped this run: ${(err as Error).message}` });
  }

  for (let r = 0; r < accountsRows.length; r++) {
    const row = accountsRows[r];
    const cellA = (row[0] ?? "").trim();
    const restEmpty = row.slice(1).every((c) => !c || !c.trim());
    if (!cellA || !restEmpty) continue; // not a candidate block-name row

    const headerRow = accountsRows[r + 1];
    const nextCellA = (headerRow?.[0] ?? "").trim();
    if (normalizeHeader(nextCellA) !== normalizeHeader("Date")) continue; // not followed by a header row

    const blockNameRowNumber = r + 1;
    const ledCol = indexHeaders(headerRow);

    const entries: ParsedLedgerEntry[] = [];
    let i = r + 2;
    for (; i < accountsRows.length; i++) {
      const dataRow = accountsRows[i];
      const entryDate = parseDate(dataRow[ledCol("Date") ?? -1]);
      if (entryDate === null || entryDate === "invalid") break; // end of block

      rowsRead++;
      const numbers: Partial<Record<keyof ParsedLedgerEntry, number | null>> = {};
      let bad = false;
      for (const [field, header] of LEDGER_NUMBER_FIELDS) {
        const value = parseNumber(dataRow[ledCol(header) ?? -1]);
        if (value === "invalid") {
          issues.push({ sheet_row_number: i + 1, issue_type: "bad_number", message: `"${cellA}": unreadable number in "${header}" — row skipped`, raw_row_data: dataRow });
          bad = true;
          break;
        }
        numbers[field] = value;
      }
      if (bad) {
        rowsSkipped++;
        continue;
      }
      entries.push({
        entry_date: entryDate,
        transaction_type: (dataRow[ledCol("Transaction") ?? -1] ?? "").trim() || "—",
        units_change: numbers.units_change ?? null,
        total_units: numbers.total_units ?? null,
        paid_in_change: numbers.paid_in_change ?? null,
        total_paid_in: numbers.total_paid_in ?? null,
        gain_loss_change: numbers.gain_loss_change ?? null,
        total_gain_loss: numbers.total_gain_loss ?? null,
        capital_change: numbers.capital_change ?? null,
        total_capital: numbers.total_capital ?? null,
        nav_per_unit: numbers.nav_per_unit ?? null,
      });
    }
    r = i - 1; // resume the outer scan right after this block

    if (!entries.length) continue;

    const investor = byNormalizedName.get(normalizeName(cellA));
    if (!investor) {
      issues.push({ sheet_row_number: blockNameRowNumber, issue_type: "ledger_block_unmatched", message: `"${ACCOUNTS_TAB}" block "${cellA}" doesn't match any investor on "${MAIN_TAB}" — ledger detail skipped` });
      continue;
    }
    ledgerByInvestorId.set(investor.id, { entries, sheetRowNumber: blockNameRowNumber });
  }

  // ---------- Write positions (ledger-derived where available) ----------
  for (const [investorId, pos] of positionsByInvestorId) {
    const ledger = ledgerByInvestorId.get(investorId);

    const positionFields = ledger?.entries.length
      ? {
          nav_at_allocation: ledger.entries[0].nav_per_unit,
          latest_nav: ledger.entries[ledger.entries.length - 1].nav_per_unit,
          current_valuation: ledger.entries[ledger.entries.length - 1].total_capital,
          total_invested: ledger.entries[ledger.entries.length - 1].total_paid_in,
          valuation_date: ledger.entries[ledger.entries.length - 1].entry_date,
        }
      : { current_valuation: pos.current, total_invested: pos.invested };

    const { data: position, error: posError } = await admin
      .from("investor_vehicle_positions")
      .upsert(
        { investor_id: investorId, vehicle_id: pos.vehicleId, ...positionFields, last_synced_at: new Date().toISOString() },
        { onConflict: "investor_id,vehicle_id" },
      )
      .select("id")
      .single();

    if (posError || !position) {
      rowsSkipped++;
      issues.push({ sheet_row_number: pos.sheetRowNumber, issue_type: "position_failed", message: `Position for ${pos.code}: ${posError?.message}` });
      continue;
    }

    if (ledger?.entries.length) {
      await admin.from("ledger_entries").delete().eq("position_id", position.id);
      const { error: insertError } = await admin
        .from("ledger_entries")
        .insert(ledger.entries.map((e, i) => ({ ...e, position_id: position.id, sort_order: i + 1 })));
      if (insertError) {
        rowsSkipped += ledger.entries.length;
        issues.push({ sheet_row_number: ledger.sheetRowNumber, issue_type: "ledger_insert_failed", message: `${pos.code}: ${insertError.message}` });
        continue;
      }
      rowsUpserted += ledger.entries.length;
    }
  }

  const INFO_ISSUES = new Set(["new_investor_created", "ledger_block_unmatched"]);
  const hasBlockingIssues = issues.some((i) => !INFO_ISSUES.has(i.issue_type));
  return finish(hasBlockingIssues ? "partial_failure" : "success");
}
