import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";
import { ReferralPieChart, type ReferralSlice } from "@/components/charts/referral-pie-chart";
import { VehicleBarChart, type VehicleBarDatum } from "@/components/charts/vehicle-bar-chart";

type InvestorRow = {
  id: string;
  investor_code: string;
  full_name: string;
  referral_sources: { name: string } | null;
  investor_vehicle_positions: {
    current_valuation: number | null;
    investment_vehicles: { name: string } | null;
    ledger_entries: { total_paid_in: number | null; sort_order: number }[];
  }[];
};

// "Amount invested" = the latest Total Paid In figure from the statement
// ledger — a value the statement already provides, not something we derive.
function investedForPosition(pos: InvestorRow["investor_vehicle_positions"][number]) {
  const latest = [...pos.ledger_entries].sort((a, b) => b.sort_order - a.sort_order)[0];
  return latest?.total_paid_in ?? 0;
}

export default async function InternalInvestorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vehicle?: string; referral?: string; min?: string; max?: string }>;
}) {
  const { q, vehicle, referral, min, max } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("investors")
    .select(
      `id, investor_code, full_name,
       referral_sources(name),
       investor_vehicle_positions(
         current_valuation,
         investment_vehicles(name),
         ledger_entries(total_paid_in, sort_order)
       )`,
    )
    .order("full_name")
    .overrideTypes<InvestorRow[]>();

  const investors = (data ?? []).map((inv) => {
    const invested = inv.investor_vehicle_positions.reduce((sum, p) => sum + investedForPosition(p), 0);
    const currentValue = inv.investor_vehicle_positions.reduce(
      (sum, p) => sum + (p.current_valuation ?? 0),
      0,
    );
    const vehicles = inv.investor_vehicle_positions
      .map((p) => p.investment_vehicles?.name)
      .filter(Boolean) as string[];
    return {
      id: inv.id,
      code: inv.investor_code,
      name: inv.full_name,
      referral: inv.referral_sources?.name ?? "Unassigned",
      vehicles,
      invested,
      currentValue,
    };
  });

  // --- summaries (aggregation of statement-provided figures, for display) ---
  const totalInvestors = investors.length;
  const totalCapital = investors.reduce((s, i) => s + i.invested, 0);
  const totalValue = investors.reduce((s, i) => s + i.currentValue, 0);

  const vehicleNames = [...new Set(investors.flatMap((i) => i.vehicles))].sort();
  const vehicleData: VehicleBarDatum[] = vehicleNames.map((name) => {
    const withVehicle = investors.filter((i) => i.vehicles.includes(name));
    return {
      name,
      capital: withVehicle.reduce((s, i) => s + i.invested, 0),
      currentValue: withVehicle.reduce((s, i) => s + i.currentValue, 0),
    };
  });

  const referralNames = [...new Set(investors.map((i) => i.referral))].sort();
  const referralData: ReferralSlice[] = referralNames.map((name) => {
    const group = investors.filter((i) => i.referral === name);
    return {
      name,
      capital: group.reduce((s, i) => s + i.invested, 0),
      investors: group.length,
    };
  });

  // --- filters ---
  const filtered = investors.filter((inv) => {
    if (q && !`${inv.name} ${inv.code}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (vehicle && !inv.vehicles.includes(vehicle)) return false;
    if (referral && inv.referral !== referral) return false;
    if (min && inv.invested < Number(min)) return false;
    if (max && inv.invested > Number(max)) return false;
    return true;
  });

  const hasFilters = Boolean(q || vehicle || referral || min || max);

  return (
    <div className="space-y-10">
      {/* Overall business */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Business overview</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-zinc-100 p-4">
            <p className="text-xs text-zinc-500">Total investors</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{totalInvestors}</p>
          </div>
          <div className="rounded-md border border-zinc-100 p-4">
            <p className="text-xs text-zinc-500">Total capital raised</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{num(totalCapital)}</p>
          </div>
          <div className="rounded-md border border-zinc-100 p-4">
            <p className="text-xs text-zinc-500">Current portfolio value</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#f4511e]">{num(totalValue)}</p>
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-zinc-100 p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Referral source summary</h3>
          <p className="text-xs text-zinc-500">Capital raised by referral source</p>
          <ReferralPieChart data={referralData} />
        </div>
        <div className="rounded-md border border-zinc-100 p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Investment vehicle summary</h3>
          <p className="text-xs text-zinc-500">Capital vs current value per vehicle</p>
          <VehicleBarChart data={vehicleData} />
        </div>
      </section>

      {/* Investor list */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Investors</h2>

        <form method="GET" className="mt-4 flex flex-wrap items-end gap-3 text-sm">
          <div>
            <label htmlFor="q" className="block text-xs text-zinc-500">
              Search
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Name or ID"
              className="mt-1 w-44 rounded-md border border-zinc-300 px-2 py-1.5 focus:border-[#f4511e] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="vehicle" className="block text-xs text-zinc-500">
              Vehicle
            </label>
            <select
              id="vehicle"
              name="vehicle"
              defaultValue={vehicle ?? ""}
              className="mt-1 rounded-md border border-zinc-300 px-2 py-1.5 focus:border-[#f4511e] focus:outline-none"
            >
              <option value="">All</option>
              {vehicleNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="referral" className="block text-xs text-zinc-500">
              Referral source
            </label>
            <select
              id="referral"
              name="referral"
              defaultValue={referral ?? ""}
              className="mt-1 rounded-md border border-zinc-300 px-2 py-1.5 focus:border-[#f4511e] focus:outline-none"
            >
              <option value="">All</option>
              {referralNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="min" className="block text-xs text-zinc-500">
              Min invested
            </label>
            <input
              id="min"
              name="min"
              type="number"
              defaultValue={min ?? ""}
              className="mt-1 w-28 rounded-md border border-zinc-300 px-2 py-1.5 focus:border-[#f4511e] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="max" className="block text-xs text-zinc-500">
              Max invested
            </label>
            <input
              id="max"
              name="max"
              type="number"
              defaultValue={max ?? ""}
              className="mt-1 w-28 rounded-md border border-zinc-300 px-2 py-1.5 focus:border-[#f4511e] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-[#f4511e] px-4 py-1.5 font-semibold text-white hover:bg-[#d8430f]"
          >
            Apply
          </button>
          {hasFilters && (
            <Link href="/internal/investors" className="py-1.5 text-zinc-500 hover:text-zinc-700">
              Clear
            </Link>
          )}
        </form>

        <div className="mt-4 overflow-x-auto rounded-md border border-zinc-100">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th className="px-4 py-2 font-medium">Investor</th>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">Referral source</th>
                <th className="px-4 py-2 text-right font-medium">Amount invested</th>
                <th className="px-4 py-2 text-right font-medium">Current value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/internal/investors/${inv.id}`}
                      className="font-medium text-zinc-900 hover:text-[#f4511e]"
                    >
                      {inv.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">{inv.code}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{inv.vehicles.join(", ")}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{inv.referral}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(inv.invested)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(inv.currentValue)}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">
                    No investors match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
