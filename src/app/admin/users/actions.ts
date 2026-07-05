"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createInternalUser(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const tempPassword = String(formData.get("tempPassword") ?? "");

  if (!email || !displayName) redirect("/admin/users/new?error=missing");
  if (tempPassword.length < 8) redirect("/admin/users/new?error=password_short");

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

  revalidatePath("/admin/users");
  redirect("/admin/users?created=1");
}

export async function setInternalUserDisabled(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  await admin
    .from("user_profiles")
    .update({ is_disabled: formData.get("disable") === "1" })
    .eq("id", String(formData.get("authUserId")))
    .eq("role", "internal"); // never disable the admin through this path

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function deleteInternalUser(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", authUserId)
    .single();
  if (profile?.role !== "internal") redirect("/admin/users?error=not_internal");

  await admin.auth.admin.deleteUser(authUserId);

  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
}

export async function resetInternalUserPassword(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const tempPassword = String(formData.get("tempPassword") ?? "");
  if (tempPassword.length < 8) redirect("/admin/users?error=password_short");

  const { error } = await admin.auth.admin.updateUserById(authUserId, { password: tempPassword });
  if (error) redirect("/admin/users?error=reset_failed");

  await admin.from("user_profiles").update({ must_change_password: true }).eq("id", authUserId);

  revalidatePath("/admin/users");
  redirect("/admin/users?reset_done=1");
}
