"use server";

// Access management only. Investor DATA is never created, edited, or deleted
// through the portal — the Google Sheet is the sole source of truth and the
// sync is the only writer. The portal manages logins (IDs) and nothing else.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { recordAudit, emailForAuthUser } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeLogin } from "@/lib/auth/authorize-login";
import { DEFAULT_STARTING_PASSWORD } from "@/lib/password-policy";

// Authorize a new portal login for an investor directly from the admin
// panel — used for joint accounts (add a second holder) and for any
// investor whose data was loaded without going through the Google Sheets
// sync (which is the only other path that creates logins).
export async function addLogin(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const investorId = String(formData.get("investorId"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const label = String(formData.get("label") ?? "Primary holder");
  const back = String(formData.get("back") ?? "/admin/investors");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`${back}?add_login=bad_email`);
  }

  const { data: investor } = await admin
    .from("investors")
    .select("full_name")
    .eq("id", investorId)
    .maybeSingle();
  if (!investor) redirect(back);

  const result = await authorizeLogin(admin, investorId, email, investor.full_name, label);

  if (result === "conflict") {
    redirect(`${back}?add_login=conflict`);
  }

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "login_added",
    targetType: "investor_login",
    targetEmail: email,
    details: { investorId, label, result },
  });

  revalidatePath(back);
  redirect(`${back}?add_login=${result}`);
}

export async function setLoginDisabled(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const disable = formData.get("disable") === "1";
  const back = String(formData.get("back") ?? "/admin/investors");
  const reason = String(formData.get("reason") ?? "");

  await admin.from("user_profiles").update({ is_disabled: disable }).eq("id", authUserId);

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: disable ? "login_disabled" : "login_enabled",
    targetType: "investor_login",
    targetEmail: await emailForAuthUser(authUserId),
    reason,
  });

  revalidatePath(back);
  redirect(back);
}

// "Reset access": for investors who've forgotten their password (there's no
// self-service reset — they email an admin). Sets the account back to the
// shared default password and forces a change on next login.
export async function resetAccess(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const back = String(formData.get("back") ?? "/admin/investors");
  const reason = String(formData.get("reason") ?? "");

  const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
    password: DEFAULT_STARTING_PASSWORD,
  });
  if (updateError) redirect(`${back}?error=reset_failed`);
  await admin.from("user_profiles").update({ must_change_password: true }).eq("id", authUserId);

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "access_reset",
    targetType: "investor_login",
    targetEmail: await emailForAuthUser(authUserId),
    reason,
  });

  revalidatePath(back);
  redirect(`${back}?reset_done=1`);
}

// For logins whose email was removed from the sheet. Note: if the email is
// still in the sheet, the next sync will re-authorize it.
export async function deleteLogin(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const back = String(formData.get("back") ?? "/admin/investors");
  const reason = String(formData.get("reason") ?? "");

  // Guard: only investor logins can be deleted here.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", authUserId)
    .single();
  if (profile?.role !== "investor") redirect(back);

  const targetEmail = await emailForAuthUser(authUserId);
  const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId); // cascades to profile + link
  if (deleteError) redirect(`${back}?error=delete_failed`);

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "login_deleted",
    targetType: "investor_login",
    targetEmail,
    reason,
  });

  revalidatePath(back);
  redirect(back);
}
