"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { recordAudit, emailForAuthUser } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { validatePassword } from "@/lib/password-policy";

export async function createInternalUser(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const tempPassword = String(formData.get("tempPassword") ?? "");

  if (!email || !displayName) redirect("/admin/users/new?error=missing");
  const policyError = validatePassword(tempPassword);
  if (policyError) {
    redirect(`/admin/users/new?error=policy&detail=${encodeURIComponent(policyError)}`);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createError) redirect("/admin/users/new?error=create_failed");

  const { error: profileError } = await admin.from("user_profiles").insert({
    id: created.user.id,
    role: "internal",
    display_name: displayName,
    must_change_password: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    redirect("/admin/users/new?error=create_failed");
  }

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "internal_user_created",
    targetType: "internal_user",
    targetEmail: email,
    details: { display_name: displayName },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?created=1");
}

export async function setInternalUserDisabled(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const disable = formData.get("disable") === "1";
  const reason = String(formData.get("reason") ?? "");

  await admin
    .from("user_profiles")
    .update({ is_disabled: disable })
    .eq("id", authUserId)
    .eq("role", "internal"); // never disable the admin through this path

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: disable ? "internal_user_disabled" : "internal_user_enabled",
    targetType: "internal_user",
    targetEmail: await emailForAuthUser(authUserId),
    reason,
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function deleteInternalUser(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const reason = String(formData.get("reason") ?? "");
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", authUserId)
    .single();
  if (profile?.role !== "internal") redirect("/admin/users?error=not_internal");

  const targetEmail = await emailForAuthUser(authUserId);
  await admin.auth.admin.deleteUser(authUserId);

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "internal_user_deleted",
    targetType: "internal_user",
    targetEmail,
    reason,
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
}

export async function resetInternalUserPassword(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const tempPassword = String(formData.get("tempPassword") ?? "");
  const policyError = validatePassword(tempPassword);
  if (policyError) {
    redirect(`/admin/users?error=policy&detail=${encodeURIComponent(policyError)}`);
  }

  const { error } = await admin.auth.admin.updateUserById(authUserId, { password: tempPassword });
  if (error) redirect("/admin/users?error=reset_failed");

  await admin.from("user_profiles").update({ must_change_password: true }).eq("id", authUserId);

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "internal_user_password_reset",
    targetType: "internal_user",
    targetEmail: await emailForAuthUser(authUserId),
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?reset_done=1");
}
