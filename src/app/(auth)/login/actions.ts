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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=invalid");
  }

  // SOP §12.3: the admin account is not usable from the standard login screen
  // (separate, unlinked /admin-login route). Respond with the same generic
  // error as a wrong password so the admin login stays undiscoverable.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role === "admin") {
    await supabase.auth.signOut();
    redirect("/login?error=invalid");
  }

  redirect("/");
}
