"use server";

// Access management only. Investor DATA is never created, edited, or deleted
// through the portal — the Google Sheet is the sole source of truth and the
// sync is the only writer. The portal manages logins (IDs) and nothing else.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

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

// "Reset access": invalidates the current password by forcing the investor
// through activation again — they request a fresh OTP at /activate and are
// required to set a new password. Complements the self-service
// forgot-password email flow.
export async function resetAccess(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const back = String(formData.get("back") ?? "/admin/investors");

  await admin.from("user_profiles").update({ must_change_password: true }).eq("id", authUserId);

  revalidatePath(back);
  redirect(`${back}?reset_done=1`);
}

// For logins whose email was removed from the sheet. Note: if the email is
// still in the sheet, the next sync will re-authorize it.
export async function deleteLogin(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));
  const back = String(formData.get("back") ?? "/admin/investors");

  // Guard: only investor logins can be deleted here.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", authUserId)
    .single();
  if (profile?.role !== "investor") redirect(back);

  await admin.auth.admin.deleteUser(authUserId); // cascades to profile + link

  revalidatePath(back);
  redirect(back);
}
