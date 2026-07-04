"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function completeFirstLogin(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    redirect("/first-login?error=too_short");
  }
  if (password !== confirmPassword) {
    redirect("/first-login?error=mismatch");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    redirect("/first-login?error=update_failed");
  }

  // Clear the forced-change flag. Uses the service-role client because
  // user_profiles has no self-update RLS policy (only admin can write it) —
  // this is the one narrow, server-only exception, scoped to this one column.
  const admin = createAdminClient();
  await admin.from("user_profiles").update({ must_change_password: false }).eq("id", user.id);

  redirect("/");
}
