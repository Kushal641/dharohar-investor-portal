"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validatePassword } from "@/lib/password-policy";

export async function completePasswordReset(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=invalid");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const policyError = validatePassword(password, { isAdmin: profile?.role === "admin" });
  if (policyError) {
    redirect(`/reset-password?error=policy&detail=${encodeURIComponent(policyError)}`);
  }
  if (password !== confirmPassword) {
    redirect("/reset-password?error=mismatch");
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    redirect("/reset-password?error=update_failed");
  }

  const admin = createAdminClient();
  await admin.from("user_profiles").update({ must_change_password: false }).eq("id", user.id);

  redirect("/");
}
