"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestActivationCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/activate?error=missing");

  const supabase = await createClient();
  // shouldCreateUser: false — only emails already authorized (by the sheet
  // sync or the admin) can receive a code; unknown emails silently no-op.
  await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  // Same response whether or not the email exists — don't leak which
  // addresses have portal access.
  redirect(`/activate?sent=1&email=${encodeURIComponent(email)}`);
}

export async function verifyActivationCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  if (!email || !code) {
    redirect(`/activate?sent=1&email=${encodeURIComponent(email)}&error=code_missing`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });

  if (error) {
    redirect(`/activate?sent=1&email=${encodeURIComponent(email)}&error=code_invalid`);
  }

  // Session established. The proxy sends them to /first-login to set a
  // password (must_change_password is true for freshly authorized logins).
  redirect("/");
}
