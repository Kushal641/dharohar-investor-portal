"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/forgot-password?error=missing");
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  // Always redirect to the "sent" state regardless of whether the email
  // exists — avoids leaking which emails have accounts.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  redirect("/forgot-password?sent=1");
}
