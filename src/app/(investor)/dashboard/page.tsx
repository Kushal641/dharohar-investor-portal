import { createClient } from "@/lib/supabase/server";

type LedgerEntry = {
  id: string;
  entry_date: string;
  transaction_type: string;
  units_change: number | null;
  total_units: number | null;
  paid_in_change: number | null;
  total_paid_in: number | null;
  gain_loss_change: number | null;
  total_gain_loss: number | null;
  capital_change: number | null;
  total_capital: number | null;
  nav_per_unit: number | null;
  remarks: string | null;
  sort_order: number;
};

type Position = {
  id: string;
  current_valuation: number | null;
  valuation_date: string | null;
  investment_vehicles: { name: string } | null;
  ledger_entries: LedgerEntry[];
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function num(value: number | null, decimals = 2) {
  if (value === null || value === undefined) return "";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const CELL = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";

export default async function InvestorDashboardPage() {
  const supabase = await createClient();

  const { data: investor } = await supabase
    .from("investors")
    .select("investor_code, full_name")
    .single();

  const { data: positions } = await supabase
    .from("investor_vehicle_positions")
    .select(
      "id, current_valuation, valuation_date, investment_vehicles(name), ledger_entries(*)",
    )
    .overrideTypes<Position[]>();

  if (!investor) {
    return (
      <p className="text-sm text-zinc-600">
        Your investor record hasn't been linked yet — contact the administrator.
      </p>
    );
  }

  return (
    <div className="space-y-12">
      {(positions ?? []).map((position) => {
        const entries = [...(position.ledger_entries ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
        return (
          <section key={position.id}>
            <div className="text-center">
              <h2 className="text-base font-semibold text-zinc-900">
                {position.investment_vehicles?.name}
              </h2>
              <p className="text-sm text-zinc-600">Individual Valuation Units Ledger</p>
            </div>

            <p className="mt-6 text-sm font-semibold text-zinc-900">{investor.full_name}</p>

            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs text-zinc-800">
                <thead>
                  <tr className="border-b border-zinc-300 text-zinc-600">
                    <th className="px-2 py-1.5 text-left font-medium">Date</th>
                    <th className="px-2 py-1.5 text-left font-medium">Transaction</th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Units
                      <br />
                      Change
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Total
                      <br />
                      Units
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Paid In
                      <br />
                      Change
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Total
                      <br />
                      Paid In
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Gain / Loss
                      <br />
                      Change
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Total
                      <br />
                      Gain / Loss
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Capital
                      <br />
                      Change
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Total
                      <br />
                      Capital
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">NAV per Unit</th>
                    <th className="px-2 py-1.5 text-left font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-zinc-100">
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(entry.entry_date)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{entry.transaction_type}</td>
                      <td className={CELL}>{num(entry.units_change)}</td>
                      <td className={CELL}>{num(entry.total_units)}</td>
                      <td className={CELL}>{num(entry.paid_in_change)}</td>
                      <td className={CELL}>{num(entry.total_paid_in)}</td>
                      <td className={CELL}>{num(entry.gain_loss_change)}</td>
                      <td className={CELL}>{num(entry.total_gain_loss)}</td>
                      <td className={CELL}>{num(entry.capital_change)}</td>
                      <td className={CELL}>{num(entry.total_capital)}</td>
                      <td className={CELL}>{num(entry.nav_per_unit, 6)}</td>
                      <td className="px-2 py-1.5">{entry.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {position.current_valuation !== null && position.valuation_date && (
              <div className="mt-3 flex items-baseline justify-between border-t-2 border-zinc-800 pt-2">
                <p className="text-xs font-bold tracking-wide text-zinc-900">
                  CURRENT VALUE AS OF {formatDate(position.valuation_date).toUpperCase()}
                </p>
                <p className="text-sm font-bold tabular-nums text-zinc-900">
                  {num(position.current_valuation)}
                </p>
              </div>
            )}
          </section>
        );
      })}

      {(positions ?? []).length === 0 && (
        <p className="text-sm text-zinc-500">No investments to display yet.</p>
      )}
    </div>
  );
}
