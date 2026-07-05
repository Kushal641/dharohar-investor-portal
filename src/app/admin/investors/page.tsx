import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";

type Row = {
  id: string;
  investor_code: string;
  full_name: string;
  is_active: boolean;
  referral_sources: { name: string } | null;
  investor_auth_links: { id: string }[];
  investor_vehicle_positions: { current_valuation: number | null }[];
};

export default async function AdminInvestorsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("investors")
    .select(
      `id, investor_code, full_name, is_active,
       referral_sources(name),
       investor_auth_links(id),
       investor_vehicle_positions(current_valuation)`,
    )
    .order("investor_code")
    .overrideTypes<Row[]>();

  const investors = data ?? [];

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">Investor access</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Investor data comes exclusively from the Google Sheet — add or change investors there and
        run a sync. This screen manages portal access (logins) only.
      </p>

      <div className="mt-6 overflow-x-auto rounded-md border border-zinc-100">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <th className="px-4 py-2 font-medium">ID</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Referral source</th>
              <th className="px-4 py-2 text-center font-medium">Logins</th>
              <th className="px-4 py-2 text-right font-medium">Current value</th>
              <th className="px-4 py-2 text-center font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {investors.map((inv) => (
              <tr key={inv.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                <td className="px-4 py-2.5 text-zinc-600">{inv.investor_code}</td>
                <td className="px-4 py-2.5 font-medium text-zinc-900">{inv.full_name}</td>
                <td className="px-4 py-2.5 text-zinc-600">{inv.referral_sources?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-center text-zinc-600">
                  {inv.investor_auth_links.length}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {num(
                    inv.investor_vehicle_positions.reduce(
                      (s, p) => s + (p.current_valuation ?? 0),
                      0,
                    ),
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      inv.is_active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {inv.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/investors/${inv.id}`}
                    className="text-sm font-medium text-[#f4511e] hover:text-[#d8430f]"
                  >
                    Manage access
                  </Link>
                </td>
              </tr>
            ))}
            {!investors.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-400">
                  No investors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
