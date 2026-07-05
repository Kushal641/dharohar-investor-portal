"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

async function resolveReferralSourceId(admin: ReturnType<typeof createAdminClient>, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data, error } = await admin
    .from("referral_sources")
    .upsert({ name: trimmed }, { onConflict: "name" })
    .select("id")
    .single();
  if (error) throw new Error(`referral source: ${error.message}`);
  return data.id;
}

export async function createInvestor(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const investorCode = String(formData.get("investorCode") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!investorCode || !fullName) redirect("/admin/investors/new?error=missing");

  const referralSourceId = await resolveReferralSourceId(
    admin,
    String(formData.get("referralSource") ?? ""),
  );

  const { data, error } = await admin
    .from("investors")
    .insert({
      investor_code: investorCode,
      full_name: fullName,
      email: String(formData.get("email") ?? "").trim() || null,
      referral_source_id: referralSourceId,
      date_of_first_investment: String(formData.get("firstInvestment") ?? "") || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    redirect(
      `/admin/investors/new?error=${error.code === "23505" ? "duplicate_code" : "failed"}`,
    );
  }

  revalidatePath("/admin/investors");
  redirect(`/admin/investors/${data.id}/edit?created=1`);
}

export async function updateInvestor(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const investorId = String(formData.get("investorId"));
  const investorCode = String(formData.get("investorCode") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!investorCode || !fullName) {
    redirect(`/admin/investors/${investorId}/edit?error=missing`);
  }

  const referralSourceId = await resolveReferralSourceId(
    admin,
    String(formData.get("referralSource") ?? ""),
  );

  const { error } = await admin
    .from("investors")
    .update({
      investor_code: investorCode,
      full_name: fullName,
      email: String(formData.get("email") ?? "").trim() || null,
      referral_source_id: referralSourceId,
      date_of_first_investment: String(formData.get("firstInvestment") ?? "") || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      is_active: formData.get("isActive") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", investorId);

  if (error) {
    redirect(
      `/admin/investors/${investorId}/edit?error=${error.code === "23505" ? "duplicate_code" : "failed"}`,
    );
  }

  revalidatePath("/admin/investors");
  redirect(`/admin/investors/${investorId}/edit?saved=1`);
}

export async function deleteInvestor(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const investorId = String(formData.get("investorId"));

  // Remove linked auth logins first (they'd be orphaned by the cascade).
  const { data: links } = await admin
    .from("investor_auth_links")
    .select("auth_user_id")
    .eq("investor_id", investorId);
  for (const link of links ?? []) {
    await admin.auth.admin.deleteUser(link.auth_user_id);
  }

  const { error } = await admin.from("investors").delete().eq("id", investorId);
  if (error) redirect(`/admin/investors/${investorId}/edit?error=failed`);

  revalidatePath("/admin/investors");
  redirect("/admin/investors?deleted=1");
}

export async function createInvestorLogin(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const investorId = String(formData.get("investorId"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const label = String(formData.get("label") ?? "Primary holder");
  const tempPassword = String(formData.get("tempPassword") ?? "");
  const back = `/admin/investors/${investorId}/edit`;

  if (!email || !displayName) redirect(`${back}?error=login_missing`);
  if (tempPassword.length < 8) redirect(`${back}?error=login_password_short`);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createError) redirect(`${back}?error=login_create_failed`);

  const { error: profileError } = await admin.from("user_profiles").insert({
    id: created.user.id,
    role: "investor",
    display_name: displayName,
    must_change_password: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    redirect(`${back}?error=login_create_failed`);
  }

  const { error: linkError } = await admin.from("investor_auth_links").insert({
    investor_id: investorId,
    auth_user_id: created.user.id,
    label,
  });
  if (linkError) {
    await admin.auth.admin.deleteUser(created.user.id);
    redirect(`${back}?error=login_create_failed`);
  }

  revalidatePath(back);
  redirect(`${back}?login_created=1`);
}

export async function resetLoginPassword(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const back = String(formData.get("back") ?? "/admin/investors");
  const tempPassword = String(formData.get("tempPassword") ?? "");
  if (tempPassword.length < 8) redirect(`${back}?error=login_password_short`);

  const { error } = await admin.auth.admin.updateUserById(authUserId, { password: tempPassword });
  if (error) redirect(`${back}?error=reset_failed`);

  await admin.from("user_profiles").update({ must_change_password: true }).eq("id", authUserId);

  revalidatePath(back);
  redirect(`${back}?reset_done=1`);
}

export async function setLoginDisabled(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const disable = formData.get("disable") === "1";
  const back = String(formData.get("back") ?? "/admin/investors");

  await admin.from("user_profiles").update({ is_disabled: disable }).eq("id", authUserId);

  revalidatePath(back);
  redirect(back);
}

export async function deleteLogin(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const back = String(formData.get("back") ?? "/admin/investors");

  await admin.auth.admin.deleteUser(authUserId); // cascades to profile + link

  revalidatePath(back);
  redirect(back);
}
