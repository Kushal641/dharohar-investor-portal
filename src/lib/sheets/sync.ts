import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSheetTab, sheetsConfigured } from "./client";
import { authorizeLogin } from "@/lib/auth/authorize-login";
import { recordAudit } from "@/lib/admin/audit";
import { DEFAULT_STARTING_PASSWORD } from "@/lib/password-policy";

// ============================================================
// Expected Google Sheet layout (two tabs). Column order doesn't matter —
// headers are matched by name (case-insensitive, ignoring spaces/slashes) —
// but row position does: the header row is found by scanning, not assumed
// to be row 1, since the real sheet has title rows above it.
//
// Tab "AIGF vs Al Maha" (the investor list):
//   S. No. | Name | Account Type | Primary Email | Secondary Email | Mobile Number | Fund |
//   Referral | Invested Amount | Current Value
//   "Fund" is "AIGF" or "Al Maha" (mapped to the full vehicle name below,
//   not stored verbatim). Rows stop at the first blank Name — everything
//   below that on the tab is on-sheet summary formulas/reference lists, not
//   investor data.
//   "Primary Email" / "Secondary Email" are optional — when present, a
//   portal login is authorized for each (Primary Email -> "Primary holder",
//   Secondary Email -> "Joint holder"), reusing the same authorizeLogin()
//   the admin "Add login" action uses. This only ever ADDS logins: removing
//   or changing an email in the sheet never disables or deletes the login
//   that was created from it — that's a manual admin action (Investors ->
//   Manage access).
//
// Tab "Accounts" (per-investor NAV ledger — stacked blocks, not one flat
// table): a row with just the investor's name in column A, immediately
// followed by a header row (Date | Transaction | Units Change | Total
// Units | Paid In Change | Total Paid In | Gain/Loss Change | Total
// Gain/Loss | Total Capital Change | Total Capital | NAV per Unit), then
// that investor's ledger rows, until a row whose Date column doesn't parse
// (blank row, or a "CURRENT VALUE AS OF ..." summary line) ends the block.
// Investors with no block (e.g. all Al Maha investors, today) get their
// position from the main tab's Invested Amount / Current Value directly,
// with no ledger detail.
//
// The main tab's Invested Amount / Current Value are ALWAYS authoritative
// for a position's headline numbers, whether or not a ledger block exists
// — a stale/unedited ledger block never overrides an edit made on the main
// tab. Ledger data only supplies supplementary stats (NAV, valuation date)
// for the statement view.
//
// Investors are matched to existing DB rows by normalized name — this
// sheet has no stable per-row ID column. An unmatched name gets a freshly
// minted "DCP-####" code (logged as an info issue so admins notice and can
// sanity-check it wasn't just a name edit, not a genuinely new investor).
//
// Below the investor rows, the same "AIGF vs Al Maha" tab also carries two
// small reference lists (arbitrary row position, found by scanning for the
// header pair — not assumed to be at a fixed row):
//   "Admin Names" | "Admin Email"     -> accounts created with role "admin"
//   "Founder View" | "Founder Email"  -> accounts created with role "founder"
// These grant the portal's two most-privileged roles, so unlike investor
// logins, an email that already belongs to an account with a DIFFERENT role
// is never auto-changed — it's flagged as a "role_conflict" issue for a
// human to resolve. Like investor logins, removing a row here never
// disables/deletes the account it created; that stays a manual admin step.
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Finds a small two-column reference list anywhere in the tab by scanning
// for adjacent cells matching (nameHeader, emailHeader) — the list's row
// position isn't fixed, since it moves as the investor table above it
// grows or shrinks. Reads rows below the header until both columns are
// blank.
function findLabeledBlock(rows: string[][], nameHeader: string, emailHeader: string) {
  const results: { sheetRowNumber: number; displayName: string; email: string }[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length - 1; c++) {
      if (
        normalizeHeader(row[c] ?? "") !== normalizeHeader(nameHeader) ||
        normalizeHeader(row[c + 1] ?? "") !== normalizeHeader(emailHeader)
      ) {
        continue;
      }
      for (let i = r + 1; i < rows.length; i++) {
        const displayName = (rows[i][c] ?? "").trim();
        const email = (rows[i][c + 1] ?? "").trim();
        if (!displayName && !email) break;
        results.push({ sheetRowNumber: i + 1, displayName, email });
      }
      return results;
    }
  }
  return results;
}

function parseNumber(raw: string | undefined): number | null | "invalid" {
  if (raw === undefined || raw.trim() === "") return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : "invalid";
}

const MONTH_NUMBERS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function parseDate(raw: string | undefined): string | null | "invalid" {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // "May 01, 2026" / "May 1, 2026" — parsed manually (month-name lookup,
  // no Date object / no toISOString() round-trip) so it can't shift by a
  // day when the server's local timezone is ahead of UTC. The WHOLE cell
  // must look like a date, not just contain one (otherwise a summary line
  // like "CURRENT VALUE AS OF MAY 31, 2026" would match too).
  const match = /^([A-Za-z]+)\.? (\d{1,2}),? (\d{4})$/.exec(trimmed);
  if (match) {
    const month = MONTH_NUMBERS[match[1].toLowerCase()];
    if (month) {
      return `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
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

  // Authorize a login from a sheet email cell, if present — reuses the same
  // create-or-link semantics as the admin "Add login" action. Never removes
  // or disables anything; a blank/removed cell is simply a no-op.
  async function authorizeEmailColumn(
    investorId: string,
    fullName: string,
    rawEmail: string | undefined,
    label: string,
    sheetRowNumber: number,
  ) {
    const raw = (rawEmail ?? "").trim();
    if (!raw) return;
    const email = raw.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      issues.push({
        sheet_row_number: sheetRowNumber,
        issue_type: "bad_email",
        message: `Investor "${fullName}": "${raw}" doesn't look like a valid email — login not created`,
      });
      return;
    }

    const result = await authorizeLogin(admin, investorId, email, fullName, label);
    if (result === "created") {
      issues.push({
        sheet_row_number: sheetRowNumber,
        issue_type: "login_created",
        message: `Login created for "${fullName}" <${email}> (${label})`,
      });
      await recordAudit({
        actorUserId: triggeredByUser ?? null,
        actorEmail: triggeredBy === "manual" ? undefined : "sheet sync (scheduled)",
        action: "login_added",
        targetType: "investor_login",
        targetEmail: email,
        details: { investorId, label, source: "sheet_sync" },
      });
    } else if (result === "conflict") {
      issues.push({
        sheet_row_number: sheetRowNumber,
        issue_type: "login_conflict",
        message: `"${email}" for "${fullName}" is already used by a different account — resolve manually in Investors -> Manage access`,
      });
    }
  }

  // Authorize an Admin/Founder account from the sheet's reference lists.
  // Unlike investor logins, an email that already belongs to an account
  // with a DIFFERENT role is never changed automatically — that's a
  // deliberate, human-only action for the portal's most-privileged roles.
  async function authorizePrivilegedAccount(
    email: string,
    rawDisplayName: string,
    role: "admin" | "founder",
    sheetRowNumber: number,
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    const roleLabel = role === "admin" ? "Admin" : "Founder";
    const displayName = rawDisplayName || normalizedEmail;

    if (!EMAIL_RE.test(normalizedEmail)) {
      issues.push({
        sheet_row_number: sheetRowNumber,
        issue_type: "bad_email",
        message: `${roleLabel} list: "${email}" doesn't look like a valid email — account not created`,
      });
      return;
    }

    async function logCreated() {
      issues.push({
        sheet_row_number: sheetRowNumber,
        issue_type: "account_created",
        message: `${roleLabel} account created for "${displayName}" <${normalizedEmail}> — starts with the default password, must change it on first login`,
      });
      await recordAudit({
        actorUserId: triggeredByUser ?? null,
        actorEmail: triggeredBy === "manual" ? undefined : "sheet sync (scheduled)",
        action: `${role}_account_created`,
        targetType: "internal_user",
        targetEmail: normalizedEmail,
        details: { source: "sheet_sync", role },
      });
    }

    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = list?.users.find((u) => u.email?.toLowerCase() === normalizedEmail);

    if (existingUser) {
      const { data: profile } = await admin
        .from("user_profiles")
        .select("role")
        .eq("id", existingUser.id)
        .maybeSingle();

      if (profile && profile.role !== role) {
        issues.push({
          sheet_row_number: sheetRowNumber,
          issue_type: "role_conflict",
          message: `"${normalizedEmail}" already has role "${profile.role}" — the sheet's ${roleLabel} list wants "${role}". Not changed automatically; update manually if intentional.`,
        });
        return;
      }
      if (!profile) {
        // Auth user exists (e.g. created some other way) but has no profile row yet.
        const { error } = await admin
          .from("user_profiles")
          .insert({ id: existingUser.id, role, display_name: displayName, must_change_password: true });
        if (!error) await logCreated();
      }
      return; // already exists with the correct role — no-op
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: DEFAULT_STARTING_PASSWORD,
      email_confirm: true,
    });
    if (createError || !created.user) {
      issues.push({
        sheet_row_number: sheetRowNumber,
        issue_type: "account_create_failed",
        message: `Could not create ${roleLabel} account for "${normalizedEmail}": ${createError?.message}`,
      });
      return;
    }

    const { error: profileError } = await admin
      .from("user_profiles")
      .insert({ id: created.user.id, role, display_name: displayName, must_change_password: true });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      issues.push({
        sheet_row_number: sheetRowNumber,
        issue_type: "account_create_failed",
        message: `Could not create ${roleLabel} profile for "${normalizedEmail}": ${profileError.message}`,
      });
      return;
    }

    await logCreated();
  }

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

    await authorizeEmailColumn(investor.id, name, row[mainCol("Primary Email") ?? -1], "Primary holder", sheetRowNumber);
    await authorizeEmailColumn(investor.id, name, row[mainCol("Secondary Email") ?? -1], "Joint holder", sheetRowNumber);

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

  // ---------- Admin / Founder reference lists (same tab, below the investor rows) ----------
  for (const entry of findLabeledBlock(mainRows, "Admin Names", "Admin Email")) {
    await authorizePrivilegedAccount(entry.email, entry.displayName, "admin", entry.sheetRowNumber);
  }
  for (const entry of findLabeledBlock(mainRows, "Founder View", "Founder Email")) {
    await authorizePrivilegedAccount(entry.email, entry.displayName, "founder", entry.sheetRowNumber);
  }

  // ---------- Accounts tab: per-investor NAV ledger blocks ----------
  const ledgerByInvestorId = new Map<string, { entries: ParsedLedgerEntry[]; sheetRowNumber: number }>();

  let accountsRows: string[][] = [];
  try {
    accountsRows = await readSheetTab(ACCOUNTS_TAB);
  } catch (err) {
    issues.push({ sheet_row_number: null, issue_type: "accounts_tab_unreadable", message: `Could not read the "${ACCOUNTS_TAB}" tab — ledger detail skipped this run: ${(err as Error).message}` });
  }

  // Later blocks in the sheet often omit their own header row, relying on
  // the most recently seen one (same 11 columns throughout the tab) — so
  // the header mapping persists across blocks instead of being required
  // immediately after every name row.
  let lastLedCol: ((name: string) => number | undefined) | null = null;

  for (let r = 0; r < accountsRows.length; r++) {
    const row = accountsRows[r];
    const cellA = (row[0] ?? "").trim();
    const restEmpty = row.slice(1).every((c) => !c || !c.trim());
    if (!cellA || !restEmpty) continue; // not a candidate block-name row

    // Look past any blank rows for either a header row (updates the
    // remembered column mapping) or, if this block has no header of its
    // own, the first ledger row directly (reusing the last mapping seen).
    let i = r + 1;
    while (i < accountsRows.length && !(accountsRows[i][0] ?? "").trim()) i++;
    if (i >= accountsRows.length) continue;

    const nextCellA = (accountsRows[i][0] ?? "").trim();
    let ledCol: ((name: string) => number | undefined) | null;
    if (normalizeHeader(nextCellA) === normalizeHeader("Date")) {
      ledCol = indexHeaders(accountsRows[i]);
      lastLedCol = ledCol;
      i++;
    } else if (lastLedCol) {
      const maybeDate = parseDate(nextCellA);
      if (maybeDate === null || maybeDate === "invalid") continue; // not a block
      ledCol = lastLedCol;
    } else {
      continue; // no header seen yet to reuse, and this isn't one
    }

    const blockNameRowNumber = r + 1;
    const entries: ParsedLedgerEntry[] = [];
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

    // The main tab's Invested Amount / Current Value are always
    // authoritative — they're what admins actually edit. Ledger data (when
    // present) only supplies supplementary stats (NAV, valuation date) for
    // the statement view; it never overrides the headline numbers, so a
    // stale or out-of-sync ledger block can't silently mask an edit made
    // on the main tab.
    const positionFields = {
      current_valuation: pos.current,
      total_invested: pos.invested,
      ...(ledger?.entries.length
        ? {
            nav_at_allocation: ledger.entries[0].nav_per_unit,
            latest_nav: ledger.entries[ledger.entries.length - 1].nav_per_unit,
            valuation_date: ledger.entries[ledger.entries.length - 1].entry_date,
          }
        : {}),
    };

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

  const INFO_ISSUES = new Set([
    "new_investor_created",
    "ledger_block_unmatched",
    "login_created",
    "account_created",
  ]);
  const hasBlockingIssues = issues.some((i) => !INFO_ISSUES.has(i.issue_type));
  return finish(hasBlockingIssues ? "partial_failure" : "success");
}
