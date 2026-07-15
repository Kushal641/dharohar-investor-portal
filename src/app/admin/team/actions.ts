"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { recordAudit, emailForAuthUser } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_STARTING_PASSWORD } from "@/lib/password-policy";

// Reset an Admin/Founder account's password back to the shared default,
// same idea as "Reset access" for investor logins (src/app/admin/investors/actions.ts).
export async function resetTeamPassword(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();

  const authUserId = String(formData.get("authUserId"));

  await admin.auth.admin.updateUserById(authUserId, { password: DEFAULT_STARTING_PASSWORD });
  await admin.from("user_profiles").update({ must_change_password: true }).eq("id", authUserId);

  await recordAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "access_reset",
    targetType: "internal_user",
    targetEmail: await emailForAuthUser(authUserId),
  });

  revalidatePath("/admin/team");
  redirect("/admin/team?reset_done=1");
}
