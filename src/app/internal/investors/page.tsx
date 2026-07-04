import { createClient } from "@/lib/supabase/server";

export default async function InternalInvestorsPage() {
  const supabase = await createClient();
  const { data: investors } = await supabase
    .from("investors")
    .select("investor_code, full_name")
    .order("full_name");

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">All investors (read-only)</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Filters by vehicle, referral source, and amount arrive in Phase 3.
      </p>
      <ul className="mt-6 divide-y divide-zinc-100 rounded-md border border-zinc-100">
        {investors?.length ? (
          investors.map((inv) => (
            <li key={inv.investor_code} className="px-4 py-3 text-sm text-zinc-700">
              {inv.investor_code} — {inv.full_name}
            </li>
          ))
        ) : (
          <li className="px-4 py-6 text-sm text-zinc-400">No investors yet.</li>
        )}
      </ul>
    </div>
  );
}
