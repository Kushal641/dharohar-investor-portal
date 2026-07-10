"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/password-policy";

export async function changePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  // This page sits in the investor route group, so the standard policy applies.
  const policyError = validatePassword(password);
  if (policyError) {
    redirect(`/account?error=policy&detail=${encodeURIComponent(policyError)}`);
  }
  if (password !== confirmPassword) {
    redirect("/account?error=mismatch");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect("/account?error=update_failed");
  }

  redirect("/account?success=1");
}
