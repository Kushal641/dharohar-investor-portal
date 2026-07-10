"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=invalid");
  }

  // If a TOTP factor is enrolled (admins), require the authenticator code
  // before the session is good for anything past AAL1 — proxy.ts enforces
  // AAL2 for /admin routes.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors && factors.totp.length > 0) {
    redirect("/login/mfa");
  }

  redirect("/");
}

export async function verifyMfa(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/login/mfa?error=missing");

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp[0];
  if (!totp) redirect("/login");

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: totp.id,
  });
  if (challengeError || !challenge) redirect("/login/mfa?error=failed");

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) redirect("/login/mfa?error=invalid");

  redirect("/");
}
