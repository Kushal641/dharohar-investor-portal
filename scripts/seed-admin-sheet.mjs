// Loads the admin master sheet ("AIGF vs Al Maha" tab, shared 2026-07-06)
// verbatim: 17 investors across two funds with invested/current values and
// referral persons. AIGF investors from the May NAV statement keep their
// detailed ledgers; Al Maha investors have summary positions only (no ledger
// detail available yet, no logins — no emails in this sheet).
//
//   node --env-file=.env.local scripts/seed-admin-sheet.mjs
//
// Requires migration 0003 (total_invested column).

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing env vars — run with: node --env-file=.env.local scripts/seed-admin-sheet.mjs");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const AIGF = "Ananta India Growth Incorporated VCC Sub-Fund 1";
const AL_MAHA = "Al Maha Investment Fund PCC - Asia Strategy";
const VALUATION_DATE = "2026-05-31";

// Verbatim from the admin sheet. `code`: existing investors keep their codes.
const INVESTORS = [
  { code: "DCP-0001", name: "Aric Lee Gitomer", fund: AIGF, referral: "Ken Majmudar", invested: 149288.42, current: 169310.42 },
  { code: "DCP-0004", name: "Thomas K John", fund: AIGF, referral: "Ken Majmudar", invested: 99363.3, current: 116145.74 },
  { code: "DCP-0002", name: "Dwipen Ghosh", fund: AIGF, referral: "Ken Majmudar", invested: 199278.49, current: 217882.01 },
  { code: "DCP-0005", name: "Pankaj Patel Tejal R Gandhi", fund: AIGF, referral: "Ken Majmudar", invested: 249004.54, current: 287673.72 },
  { code: "DCP-0006", name: "Lalchandani Sunil Kumar Naraindas & Pravin Kanyalal Ramchandani", fund: AIGF, referral: "Bhvuan Gupta", invested: 99522.62, current: 117343.69 },
  { code: "DCP-0003", name: "Varsha and Bhuvan Gupta", fund: AIGF, referral: "Bhvuan Gupta", invested: 100000, current: 124079.57 },
  { code: "DCP-0007", name: "Anirudh Talwar", fund: AL_MAHA, referral: "Bhvuan Gupta", invested: 340816, current: 368156 },
  { code: "DCP-0008", name: "Khuzema Mohamedhusain Amthaniwala & Alefya Khuzema Amthaniwala", fund: AL_MAHA, referral: "Bhvuan Gupta", invested: 218518, current: 265055 },
  { code: "DCP-0009", name: "Ashish Khemka & Nikita Khemka", fund: AL_MAHA, referral: "Bhvuan Gupta", invested: 149033, current: 175316 },
  { code: "DCP-0010", name: "Dinesh Ramchand Moolrajani", fund: AL_MAHA, referral: "Bhvuan Gupta", invested: 111427, current: 118059.91 },
  { code: "DCP-0011", name: "Mrs. Neelu Shivlani & Mr. Bhagwan Shivlanil", fund: AL_MAHA, referral: "Bhvuan Gupta", invested: 248332, current: 296814 },
  { code: "DCP-0012", name: "Nidhi Gupta & Rohit Kedarnath Gupta", fund: AL_MAHA, referral: "Bhvuan Gupta", invested: 748388, current: 839689 },
  { code: "DCP-0013", name: "Gaurav Mehta & Surbhi Gupta", fund: AL_MAHA, referral: "Bhvuan Gupta", invested: 250000, current: 273747 },
  { code: "DCP-0014", name: "Sagar Suhas Dixit & Sakshi Sagar Dixit", fund: AL_MAHA, referral: "Bhvuan Gupta", invested: 263697, current: 397317 },
  { code: "DCP-0015", name: "Anand Somaya & Milan Somaya", fund: AL_MAHA, referral: "Bhvuan Gupta", invested: 249990, current: 310398 },
  { code: "DCP-0016", name: "Nita Kishnani & Pradeep Kishnani", fund: AL_MAHA, referral: "Bhvuan Gupta", invested: 700000, current: 714879 },
  { code: "DCP-0017", name: "Suresh Advani", fund: AL_MAHA, referral: "Bhvuan Gupta", invested: 100000, current: 100000 },
];

// Detailed ledgers from the May 2026 NAV statement for the AIGF investors
// that didn't have them seeded yet. (Aric, Dwipen, Varsha already loaded.)
const LEDGERS = {
  "DCP-0004": [
    { entry_date: "2026-05-01", transaction_type: "Beginning balance", units_change: 985.25, total_units: 985.25, paid_in_change: 99363.3, total_paid_in: 99363.3, gain_loss_change: 10258.44, total_gain_loss: 10258.44, capital_change: 109621.74, total_capital: 109621.74, nav_per_unit: 111.262335, sort_order: 1 },
    { entry_date: "2026-05-31", transaction_type: "Gains/losses allocation", total_units: 985.25, total_paid_in: 99363.3, gain_loss_change: 6523.99, total_gain_loss: 16782.44, capital_change: 6523.99, total_capital: 116145.74, nav_per_unit: 117.883967, sort_order: 2 },
  ],
  "DCP-0005": [
    { entry_date: "2026-05-01", transaction_type: "Beginning balance", units_change: 2440.31, total_units: 2440.31, paid_in_change: 249004.54, total_paid_in: 249004.54, gain_loss_change: 22510.33, total_gain_loss: 22510.33, capital_change: 271514.87, total_capital: 271514.87, nav_per_unit: 111.262335, sort_order: 1 },
    { entry_date: "2026-05-31", transaction_type: "Gains/losses allocation", total_units: 2440.31, total_paid_in: 249004.54, gain_loss_change: 16158.85, total_gain_loss: 38669.18, capital_change: 16158.85, total_capital: 287673.72, nav_per_unit: 117.883967, sort_order: 2 },
  ],
  "DCP-0006": [
    { entry_date: "2026-05-01", transaction_type: "Beginning balance", units_change: 995.42, total_units: 995.42, paid_in_change: 99522.62, total_paid_in: 99522.62, gain_loss_change: 11229.79, total_gain_loss: 11229.79, capital_change: 110752.41, total_capital: 110752.41, nav_per_unit: 111.262334, sort_order: 1 },
    { entry_date: "2026-05-31", transaction_type: "Gains/losses allocation", total_units: 995.42, total_paid_in: 99522.62, gain_loss_change: 6591.28, total_gain_loss: 17821.07, capital_change: 6591.28, total_capital: 117343.69, nav_per_unit: 117.883967, sort_order: 2 },
  ],
};

async function main() {
  const vehicleIds = {};
  for (const name of [AIGF, AL_MAHA]) {
    const { data, error } = await admin
      .from("investment_vehicles")
      .upsert({ name }, { onConflict: "name" })
      .select("id")
      .single();
    if (error) throw new Error(`vehicle ${name}: ${error.message}`);
    vehicleIds[name] = data.id;
  }

  const referralIds = {};
  for (const inv of INVESTORS) {
    if (referralIds[inv.referral]) continue;
    const { data, error } = await admin
      .from("referral_sources")
      .upsert({ name: inv.referral }, { onConflict: "name" })
      .select("id")
      .single();
    if (error) throw new Error(`referral ${inv.referral}: ${error.message}`);
    referralIds[inv.referral] = data.id;
  }

  for (const inv of INVESTORS) {
    const { data: investor, error } = await admin
      .from("investors")
      .upsert(
        {
          investor_code: inv.code,
          full_name: inv.name,
          referral_source_id: referralIds[inv.referral],
          date_of_first_investment: "2026-05-01",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "investor_code" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`investor ${inv.code}: ${error.message}`);

    const { data: position, error: posError } = await admin
      .from("investor_vehicle_positions")
      .upsert(
        {
          investor_id: investor.id,
          vehicle_id: vehicleIds[inv.fund],
          total_invested: inv.invested,
          current_valuation: inv.current,
          valuation_date: VALUATION_DATE,
          ...(inv.fund === AIGF ? { nav_at_allocation: 111.262335, latest_nav: 117.883967 } : {}),
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "investor_id,vehicle_id" },
      )
      .select("id")
      .single();
    if (posError) throw new Error(`position ${inv.code}: ${posError.message}`);

    if (LEDGERS[inv.code]) {
      await admin.from("ledger_entries").delete().eq("position_id", position.id);
      const { error: ledgerError } = await admin
        .from("ledger_entries")
        .insert(LEDGERS[inv.code].map((e) => ({ ...e, position_id: position.id })));
      if (ledgerError) throw new Error(`ledger ${inv.code}: ${ledgerError.message}`);
    }
    console.log(`seeded ${inv.code} — ${inv.name}`);
  }

  console.log("\nDone: 17 investors, 2 funds, 2 referral sources loaded from admin sheet.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
