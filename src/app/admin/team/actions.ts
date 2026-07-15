"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { recordAudit, emailForAuthUser } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_STARTING_PASSWORD } from "@/lib/password-policy";

// Reset an Admin/Founder account's password back to the shared default,
// same idea as "Reset access" for investor logins (src/app/admin/investors/actions.ts).
export async function resetTeamPassword(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));

  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    password: DEFAULT_STARTING_PASSWORD,
  });
  if (error) redirect(`/admin/team?error=reset_failed&detail=${encodeURIComponent(error.message)}`);
  await admin.from("user_profiles").update({ must_change_password: true }).eq("id", authUserId);

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "access_reset",
    targetType: "internal_user",
    targetEmail: await emailForAuthUser(authUserId),
  });

  revalidatePath("/admin/team");
  redirect("/admin/team?reset_done=1");
}

// The sheet's Admin Email / Founder Email lists only ever ADD accounts
// (src/lib/sheets/sync.ts) — removing a row from the sheet never disables
// or deletes anything, so this is how you actually revoke someone's access
// once they're gone from the sheet.
export async function setTeamAccountDisabled(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const disable = formData.get("disable") === "1";

  if (authUserId === actor.id) redirect("/admin/team?error=self");

  await admin.from("user_profiles").update({ is_disabled: disable }).eq("id", authUserId);

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: disable ? "login_disabled" : "login_enabled",
    targetType: "internal_user",
    targetEmail: await emailForAuthUser(authUserId),
  });

  revalidatePath("/admin/team");
  redirect("/admin/team");
}

export async function deleteTeamAccount(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));

  if (authUserId === actor.id) redirect("/admin/team?error=self");

  const targetEmail = await emailForAuthUser(authUserId);
  const { error } = await admin.auth.admin.deleteUser(authUserId); // cascades to the profile row
  if (error) redirect(`/admin/team?error=delete_failed&detail=${encodeURIComponent(error.message)}`);

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "login_deleted",
    targetType: "internal_user",
    targetEmail,
  });

  revalidatePath("/admin/team");
  redirect("/admin/team?deleted=1");
}
