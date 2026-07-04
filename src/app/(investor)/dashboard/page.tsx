import { createClient } from "@/lib/supabase/server";

export default async function InvestorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("id", user!.id)
    .single();

  const { data: investor } = await supabase
    .from("investors")
    .select("investor_code, full_name")
    .single();

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">
        Welcome, {profile?.display_name ?? "Investor"}
      </h2>
      <p className="mt-2 text-sm text-zinc-600">
        {investor
          ? `Investor ID ${investor.investor_code} — ${investor.full_name}`
          : "Your investor record hasn't been linked yet — contact the administrator."}
      </p>
      <p className="mt-8 rounded-md border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-400">
        Investment vehicles, top-ups, and current valuation will appear here (Phase 2).
      </p>
    </div>
  );
}
