// Phase 2 seed — loads real entries from the May 2026 NAV statement
// ("Individual Valuation Units Ledger", Ananta India Growth Incorporated VCC
// Sub-Fund 1) verbatim, replacing the placeholder DCP-TEST investors.
//
//   node --env-file=.env.local scripts/seed-nav-statement.mjs
//
// Login mapping (existing test logins, password Test-Pass-123):
//   investor.a@dharohar-test.com  + investor.a2@... (joint) -> Varsha & Bhuvan Gupta
//   investor.b@dharohar-test.com                            -> Aric Lee Gitomer
//   investor.c@dharohar-test.com  (created)                 -> Dwipen Ghosh

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing env vars — run with: node --env-file=.env.local scripts/seed-nav-statement.mjs");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const PASSWORD = "Test-Pass-123";

const VEHICLE = "Ananta India Growth Incorporated VCC Sub-Fund 1";
const VALUATION_DATE = "2026-05-31";

// Verbatim from the statement PDF (May 01 – May 31, 2026).
const STATEMENT = [
  {
    code: "DCP-0001",
    name: "Aric Lee Gitomer",
    referral: "USA Office", // sample value — real referral sources come from admin/sheet later
    logins: [{ email: "investor.b@dharohar-test.com", label: "Primary holder", display: "Aric Lee Gitomer" }],
    currentValue: 169310.42,
    entries: [
      { entry_date: "2026-05-01", transaction_type: "Beginning balance", units_change: 1436.25, total_units: 1436.25, paid_in_change: 149288.42, total_paid_in: 149288.42, gain_loss_change: 10511.71, total_gain_loss: 10511.71, capital_change: 159800.13, total_capital: 159800.13, nav_per_unit: 111.262335, sort_order: 1 },
      { entry_date: "2026-05-31", transaction_type: "Gains/losses allocation", total_units: 1436.25, total_paid_in: 149288.42, gain_loss_change: 9510.3, total_gain_loss: 20022.0, capital_change: 9510.3, total_capital: 169310.42, nav_per_unit: 117.883967, sort_order: 2 },
    ],
  },
  {
    code: "DCP-0002",
    name: "Dwipen Ghosh",
    referral: "Dubai Office",
    logins: [{ email: "investor.c@dharohar-test.com", label: "Primary holder", display: "Dwipen Ghosh" }],
    currentValue: 117882.01,
    entries: [
      { entry_date: "2026-05-01", transaction_type: "Beginning balance", units_change: 999.98, total_units: 999.98, paid_in_change: 99278.49, total_paid_in: 99278.49, gain_loss_change: 11982.0, total_gain_loss: 11982.0, capital_change: 111260.49, total_capital: 111260.49, nav_per_unit: 111.262335, sort_order: 1 },
      { entry_date: "2026-05-31", transaction_type: "Gains/losses allocation", total_units: 999.98, total_paid_in: 99278.49, gain_loss_change: 6621.52, total_gain_loss: 18603.52, capital_change: 6621.52, total_capital: 117882.01, nav_per_unit: 117.883967, sort_order: 2 },
    ],
  },
  {
    code: "DCP-0003",
    name: "Varsha & Bhuvan Gupta",
    referral: "Dubai Office",
    logins: [
      { email: "investor.a@dharohar-test.com", label: "Primary holder", display: "Varsha Gupta" },
      { email: "investor.a2@dharohar-test.com", label: "Joint holder", display: "Bhuvan Gupta" },
    ],
    currentValue: 124079.57,
    entries: [
      { entry_date: "2026-05-01", transaction_type: "Beginning balance", units_change: 1052.56, total_units: 1052.56, paid_in_change: 100000.0, total_paid_in: 100000.0, gain_loss_change: 17109.92, total_gain_loss: 17109.92, capital_change: 117109.92, total_capital: 117109.92, nav_per_unit: 111.262335, sort_order: 1 },
      { entry_date: "2026-05-31", transaction_type: "Gains/losses allocation", total_units: 1052.56, total_paid_in: 100000.0, gain_loss_change: 6969.64, total_gain_loss: 24079.57, capital_change: 6969.64, total_capital: 124079.57, nav_per_unit: 117.883967, sort_order: 2 },
    ],
  },
];

async function ensureAuthUser(email, displayName) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list.users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw new Error(`createUser(${email}): ${error.message}`);
    user = data.user;
    console.log(`created auth user ${email}`);
  }
  const { error } = await admin.from("user_profiles").upsert({
    id: user.id,
    role: "investor",
    display_name: displayName,
    must_change_password: false,
  });
  if (error) throw new Error(`user_profiles(${email}): ${error.message}`);
  return user;
}

async function main() {
  // Remove the Phase 1 placeholder investors (cascades to links/positions/ledger).
  await admin.from("investors").delete().in("investor_code", ["DCP-TEST-001", "DCP-TEST-002"]);
  console.log("removed placeholder DCP-TEST investors");

  const { data: vehicle, error: vehErr } = await admin
    .from("investment_vehicles")
    .upsert({ name: VEHICLE }, { onConflict: "name" })
    .select("id")
    .single();
  if (vehErr) throw new Error(`vehicle: ${vehErr.message}`);

  for (const inv of STATEMENT) {
    let referralSourceId = null;
    if (inv.referral) {
      const { data: ref, error: refErr } = await admin
        .from("referral_sources")
        .upsert({ name: inv.referral }, { onConflict: "name" })
        .select("id")
        .single();
      if (refErr) throw new Error(`referral(${inv.referral}): ${refErr.message}`);
      referralSourceId = ref.id;
    }

    const { data: investor, error: invErr } = await admin
      .from("investors")
      .upsert(
        {
          investor_code: inv.code,
          full_name: inv.name,
          date_of_first_investment: "2026-05-01",
          referral_source_id: referralSourceId,
        },
        { onConflict: "investor_code" },
      )
      .select("id")
      .single();
    if (invErr) throw new Error(`investor(${inv.code}): ${invErr.message}`);

    for (const login of inv.logins) {
      const user = await ensureAuthUser(login.email, login.display);
      const { error } = await admin
        .from("investor_auth_links")
        .upsert({ investor_id: investor.id, auth_user_id: user.id, label: login.label }, { onConflict: "auth_user_id" });
      if (error) throw new Error(`link(${login.email}): ${error.message}`);
    }

    const { data: position, error: posErr } = await admin
      .from("investor_vehicle_positions")
      .upsert(
        {
          investor_id: investor.id,
          vehicle_id: vehicle.id,
          nav_at_allocation: 111.262335,
          latest_nav: 117.883967,
          current_valuation: inv.currentValue,
          valuation_date: VALUATION_DATE,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "investor_id,vehicle_id" },
      )
      .select("id")
      .single();
    if (posErr) throw new Error(`position(${inv.code}): ${posErr.message}`);

    // Idempotent: rebuild this position's ledger from the statement.
    await admin.from("ledger_entries").delete().eq("position_id", position.id);
    const { error: ledgerErr } = await admin
      .from("ledger_entries")
      .insert(inv.entries.map((e) => ({ ...e, position_id: position.id })));
    if (ledgerErr) throw new Error(`ledger(${inv.code}): ${ledgerErr.message}`);

    console.log(`seeded ${inv.code} — ${inv.name} (current value ${inv.currentValue.toLocaleString("en-US")})`);
  }

  console.log("\nDone. Statement data loaded verbatim.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
