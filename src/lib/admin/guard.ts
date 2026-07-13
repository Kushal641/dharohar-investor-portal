import "server-only";
import { createClient } from "@/lib/supabase/server";

// Every admin server action re-verifies the caller's role server-side before
// touching the service-role client — never trust that the UI was the only
// path to the action.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Not authorized");
  return user;
}

// Founder sees everything admin sees but can never mutate anything — pages
// call this to decide whether to render action buttons/forms. The actual
// enforcement is requireAdmin() above (unchanged), which every mutating
// server action calls; this is only about what the UI offers to click.
export async function isReadOnlyViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "founder";
}
