"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { runSync } from "@/lib/sheets/sync";
import { sendSyncAlert } from "@/lib/sheets/alert";

export async function syncNow() {
  const user = await requireAdmin();
  const result = await runSync("manual", user.id);
  await sendSyncAlert(result);
  revalidatePath("/admin/sync");
  redirect("/admin/sync");
}
