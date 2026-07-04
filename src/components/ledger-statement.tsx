import { formatDate, num } from "@/lib/format";

export type LedgerEntry = {
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

export type LedgerPosition = {
  id: string;
  current_valuation: number | null;
  valuation_date: string | null;
  investment_vehicles: { name: string } | null;
  ledger_entries: LedgerEntry[];
};

const CELL = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";

const HEADERS: { label: string[]; align: "left" | "right" }[] = [
  { label: ["Date"], align: "left" },
  { label: ["Transaction"], align: "left" },
  { label: ["Units", "Change"], align: "right" },
  { label: ["Total", "Units"], align: "right" },
  { label: ["Paid In", "Change"], align: "right" },
  { label: ["Total", "Paid In"], align: "right" },
  { label: ["Gain / Loss", "Change"], align: "right" },
  { label: ["Total", "Gain / Loss"], align: "right" },
  { label: ["Capital", "Change"], align: "right" },
  { label: ["Total", "Capital"], align: "right" },
  { label: ["NAV per Unit"], align: "right" },
  { label: ["Remarks"], align: "left" },
];

export function LedgerStatement({
  investorName,
  position,
}: {
  investorName: string;
  position: LedgerPosition;
}) {
  const entries = [...(position.ledger_entries ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <section>
      <div className="text-center">
        <h2 className="text-base font-semibold text-zinc-900">
          {position.investment_vehicles?.name}
        </h2>
        <p className="text-sm text-zinc-600">Individual Valuation Units Ledger</p>
      </div>

      <p className="mt-6 text-sm font-semibold text-zinc-900">{investorName}</p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-xs text-zinc-800">
          <thead>
            <tr className="border-b border-zinc-300 text-zinc-600">
              {HEADERS.map((h) => (
                <th
                  key={h.label.join(" ")}
                  className={`px-2 py-1.5 font-medium ${h.align === "right" ? "text-right" : "text-left"}`}
                >
                  {h.label.map((line, i) => (
                    <span key={line}>
                      {i > 0 && <br />}
                      {line}
                    </span>
                  ))}
                </th>
              ))}
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
}
