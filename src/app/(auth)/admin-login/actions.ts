"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function adminLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/admin-login?error=missing");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/admin-login?error=invalid");
  }

  // Only the administrator may use this route; everyone else gets the same
  // generic error as a bad password.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, is_disabled")
    .eq("id", data.user.id)
    .single();

  if (!profile || profile.role !== "admin" || profile.is_disabled) {
    await supabase.auth.signOut();
    redirect("/admin-login?error=invalid");
  }

  // If a TOTP factor is enrolled, require the authenticator code before the
  // session is good for admin routes (proxy enforces AAL2 for /admin).
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors && factors.totp.length > 0) {
    redirect("/admin-login/mfa");
  }

  redirect("/");
}

export async function verifyAdminMfa(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/admin-login/mfa?error=missing");

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp[0];
  if (!totp) redirect("/admin-login");

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: totp.id,
  });
  if (challengeError || !challenge) redirect("/admin-login/mfa?error=failed");

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) redirect("/admin-login/mfa?error=invalid");

  redirect("/");
}
