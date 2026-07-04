"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function completePasswordReset(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    redirect("/reset-password?error=too_short");
  }
  if (password !== confirmPassword) {
    redirect("/reset-password?error=mismatch");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=invalid");
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    redirect("/reset-password?error=update_failed");
  }

  const admin = createAdminClient();
  await admin.from("user_profiles").update({ must_change_password: false }).eq("id", user.id);

  redirect("/");
}
