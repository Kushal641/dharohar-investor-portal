import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_STARTING_PASSWORD } from "@/lib/password-policy";

// Idempotently ensure `email` is an authorized investor login linked to
// `investorId`. Returns "created" | "existing" | "conflict". Shared by the
// Google Sheets sync (src/lib/sheets/sync.ts) and the admin "Add login"
// action (src/app/admin/investors/actions.ts) — both need the exact same
// create-or-link semantics.
export async function authorizeLogin(
  admin: ReturnType<typeof createAdminClient>,
  investorId: string,
  email: string,
  displayName: string,
  label: string,
): Promise<"created" | "existing" | "conflict"> {
  // Already an auth user with this email?
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = list.users.find((u) => u.email?.toLowerCase() === email);

  if (existingUser) {
    const { data: link } = await admin
      .from("investor_auth_links")
      .select("investor_id")
      .eq("auth_user_id", existingUser.id)
      .maybeSingle();
    if (link) return link.investor_id === investorId ? "existing" : "conflict";

    // Auth user exists but isn't linked (e.g. internal user email reused).
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role")
      .eq("id", existingUser.id)
      .maybeSingle();
    if (profile && profile.role !== "investor") return "conflict";

    if (!profile) {
      await admin.from("user_profiles").insert({
        id: existingUser.id,
        role: "investor",
        display_name: displayName,
        must_change_password: true,
      });
    }
    const { error } = await admin
      .from("investor_auth_links")
      .insert({ investor_id: investorId, auth_user_id: existingUser.id, label });
    return error ? "conflict" : "created";
  }

  // Brand-new: starts with the shared default password, must change it on
  // first login (must_change_password below).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_STARTING_PASSWORD,
    email_confirm: true,
  });
  if (createError || !created.user) return "conflict";

  const { error: profileError } = await admin.from("user_profiles").insert({
    id: created.user.id,
    role: "investor",
    display_name: displayName,
    must_change_password: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return "conflict";
  }

  const { error: linkError } = await admin
    .from("investor_auth_links")
    .insert({ investor_id: investorId, auth_user_id: created.user.id, label });
  if (linkError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return "conflict";
  }
  return "created";
}
