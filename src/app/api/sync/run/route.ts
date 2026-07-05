import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runSync } from "@/lib/sheets/sync";
import { sendSyncAlert } from "@/lib/sheets/alert";

export const maxDuration = 300; // sheet reads + upserts can take a while

// Called two ways:
//  - Vercel Cron (monthly): sends "Authorization: Bearer <CRON_SECRET>"
//  - never by browsers directly; the admin UI uses a server action instead
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  let triggeredBy: "manual" | "scheduled" | null = null;
  let userId: string | undefined;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    triggeredBy = "scheduled";
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role === "admin") {
        triggeredBy = "manual";
        userId = user.id;
      }
    }
  }

  if (!triggeredBy) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSync(triggeredBy, userId);
  await sendSyncAlert(result);

  return NextResponse.json({
    runId: result.runId,
    status: result.status,
    rowsRead: result.rowsRead,
    rowsUpserted: result.rowsUpserted,
    rowsSkipped: result.rowsSkipped,
    issueCount: result.issues.length,
  });
}

// Vercel Cron uses GET.
export const GET = POST;
