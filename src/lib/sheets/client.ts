import "server-only";
import { google } from "googleapis";

export function sheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_SHEET_ID,
  );
}

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Vercel/env files store the key with literal \n sequences.
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

// Tab names in the real sheet can carry quirks (trailing spaces, case
// differences) that break an exact-string range lookup. Resolve the wanted
// name against the spreadsheet's actual tab titles (trimmed, case-insensitive)
// before reading, so small naming drift doesn't break the sync.
async function resolveTabTitle(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
  wantedName: string,
): Promise<string> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "");
  const match = titles.find((t) => t.trim().toLowerCase() === wantedName.trim().toLowerCase());
  if (!match) {
    throw new Error(`Sheet tab "${wantedName}" not found. Available tabs: ${titles.join(", ")}`);
  }
  return match;
}

export async function readSheetTab(tabName: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
  const resolvedTitle = await resolveTabTitle(sheets, spreadsheetId, tabName);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: resolvedTitle,
  });

  return (response.data.values ?? []) as string[][];
}
