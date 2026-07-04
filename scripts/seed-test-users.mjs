// Phase 1 test seed — creates test logins and sample data, then verifies RLS isolation.
// Run AFTER the migration (supabase/migrations/0001_init_schema.sql) has been executed
// in the Supabase SQL Editor:
//
//   node --env-file=.env.local scripts/seed-test-users.mjs
//
// Test accounts created (all passwords: Test-Pass-123):
//   admin@dharohar-test.com      admin
//   internal@dharohar-test.com   internal (read-only)
//   investor.a@dharohar-test.com investor — Ramesh Test (DCP-TEST-001)
//   investor.a2@dharohar-test.com joint holder — same investor record as investor.a
//   investor.b@dharohar-test.com investor — Suresh Test (DCP-TEST-002)
//
// Safe to re-run: it skips users/records that already exist.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase env vars — run with: node --env-file=.env.local scripts/seed-test-users.mjs");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const PASSWORD = "Test-Pass-123";

async function ensureUser(email, role, displayName, mustChangePassword = false) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list.users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser(${email}): ${error.message}`);
    user = data.user;
    console.log(`created auth user ${email}`);
  } else {
    console.log(`auth user ${email} already exists`);
  }

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: user.id,
    role,
    display_name: displayName,
    must_change_password: mustChangePassword,
  });
  if (profileError) throw new Error(`user_profiles(${email}): ${profileError.message}`);
  return user;
}

async function ensureInvestor(code, fullName) {
  const { data: existing } = await admin.from("investors").select("id").eq("investor_code", code).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("investors")
    .insert({ investor_code: code, full_name: fullName, date_of_first_investment: "2025-01-01" })
    .select("id")
    .single();
  if (error) throw new Error(`investors(${code}): ${error.message}`);
  console.log(`created investor ${code}`);
  return data.id;
}

async function ensureLink(investorId, authUserId, label) {
  const { error } = await admin
    .from("investor_auth_links")
    .upsert({ investor_id: investorId, auth_user_id: authUserId, label }, { onConflict: "auth_user_id" });
  if (error) throw new Error(`investor_auth_links: ${error.message}`);
}

async function main() {
  // --- users ---
  await ensureUser("admin@dharohar-test.com", "admin", "Test Admin");
  await ensureUser("internal@dharohar-test.com", "internal", "Test Internal");
  const invA = await ensureUser("investor.a@dharohar-test.com", "investor", "Ramesh Test");
  const invA2 = await ensureUser("investor.a2@dharohar-test.com", "investor", "Ramesh Test (Joint)", true);
  const invB = await ensureUser("investor.b@dharohar-test.com", "investor", "Suresh Test");

  // --- investors + joint link ---
  const investorA = await ensureInvestor("DCP-TEST-001", "Ramesh Test");
  const investorB = await ensureInvestor("DCP-TEST-002", "Suresh Test");
  await ensureLink(investorA, invA.id, "Primary holder");
  await ensureLink(investorA, invA2.id, "Joint holder");
  await ensureLink(investorB, invB.id, "Primary holder");

  // --- sample vehicle / position / contributions (display data for Phase 2) ---
  const { data: vehicle } = await admin
    .from("investment_vehicles")
    .upsert({ name: "Ananta India Growth Fund" }, { onConflict: "name" })
    .select("id")
    .single();

  const { data: position, error: posError } = await admin
    .from("investor_vehicle_positions")
    .upsert(
      {
        investor_id: investorA,
        vehicle_id: vehicle.id,
        nav_at_allocation: 100.0,
        latest_nav: 112.4,
        current_valuation: 84300.0,
      },
      { onConflict: "investor_id,vehicle_id" },
    )
    .select("id")
    .single();
  if (posError) throw new Error(`positions: ${posError.message}`);

  for (const c of [
    { contribution_date: "2025-01-01", amount: 50000, nav_at_contribution: 100.0 },
    { contribution_date: "2025-04-15", amount: 25000, nav_at_contribution: 104.2 },
  ]) {
    await admin
      .from("contributions")
      .upsert({ position_id: position.id, ...c }, { onConflict: "position_id,contribution_date,amount", ignoreDuplicates: true });
  }
  console.log("seed data in place\n");

  // --- RLS verification: investor A must see only their own data ---
  console.log("Verifying RLS isolation...");
  const asInvestorA = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await asInvestorA.auth.signInWithPassword({
    email: "investor.a@dharohar-test.com",
    password: PASSWORD,
  });
  if (signInError) throw new Error(`sign-in failed: ${signInError.message}`);

  const { data: visibleInvestors } = await asInvestorA.from("investors").select("investor_code");
  const codes = (visibleInvestors ?? []).map((r) => r.investor_code).sort();

  if (codes.length === 1 && codes[0] === "DCP-TEST-001") {
    console.log("PASS: investor A sees only DCP-TEST-001");
  } else {
    console.error(`FAIL: investor A sees: ${JSON.stringify(codes)} (expected only DCP-TEST-001)`);
    process.exit(1);
  }

  const { error: writeError } = await asInvestorA
    .from("investors")
    .update({ full_name: "Hacked" })
    .eq("investor_code", "DCP-TEST-001");
  const { data: afterWrite } = await asInvestorA.from("investors").select("full_name").single();
  if (afterWrite.full_name === "Ramesh Test") {
    console.log("PASS: investor cannot modify their own record" + (writeError ? ` (rejected: ${writeError.message})` : " (write silently ignored by RLS)"));
  } else {
    console.error("FAIL: investor was able to modify investors table");
    process.exit(1);
  }

  // Joint holder sees the same investor record
  const asJoint = createClient(url, anonKey, { auth: { persistSession: false } });
  await asJoint.auth.signInWithPassword({ email: "investor.a2@dharohar-test.com", password: PASSWORD });
  const { data: jointSees } = await asJoint.from("investors").select("investor_code");
  if (jointSees?.length === 1 && jointSees[0].investor_code === "DCP-TEST-001") {
    console.log("PASS: joint holder sees the same shared account (DCP-TEST-001)");
  } else {
    console.error(`FAIL: joint holder sees: ${JSON.stringify(jointSees)}`);
    process.exit(1);
  }

  // Internal user: sees all, cannot write
  const asInternal = createClient(url, anonKey, { auth: { persistSession: false } });
  await asInternal.auth.signInWithPassword({ email: "internal@dharohar-test.com", password: PASSWORD });
  const { data: internalSees } = await asInternal.from("investors").select("investor_code");
  if ((internalSees ?? []).length >= 2) {
    console.log(`PASS: internal user sees all ${internalSees.length} investors`);
  } else {
    console.error(`FAIL: internal user sees: ${JSON.stringify(internalSees)}`);
    process.exit(1);
  }
  await asInternal.from("investors").update({ full_name: "Hacked" }).eq("investor_code", "DCP-TEST-002");
  const { data: bAfter } = await asInternal
    .from("investors")
    .select("full_name")
    .eq("investor_code", "DCP-TEST-002")
    .single();
  if (bAfter.full_name === "Suresh Test") {
    console.log("PASS: internal user is read-only");
  } else {
    console.error("FAIL: internal user modified data");
    process.exit(1);
  }

  console.log("\nAll RLS checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
