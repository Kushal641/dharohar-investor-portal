import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ROLE_HOME: Record<string, string> = {
  investor: "/dashboard",
  internal: "/internal/investors",
  admin: "/admin/dashboard",
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, must_change_password")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login?error=no_profile");
  if (profile.must_change_password) redirect("/first-login");

  redirect(ROLE_HOME[profile.role] ?? "/login");
}
