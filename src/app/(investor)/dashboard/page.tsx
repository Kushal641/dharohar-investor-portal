import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { LedgerStatement, type LedgerPosition } from "@/components/ledger-statement";
import { NavLineChart } from "@/components/charts/nav-line-chart";

export default async function InvestorDashboardPage() {
  const supabase = await createClient();

  const { data: investor } = await supabase
    .from("investors")
    .select("investor_code, full_name")
    .single();

  const { data: positions } = await supabase
    .from("investor_vehicle_positions")
    .select("id, current_valuation, valuation_date, investment_vehicles(name), ledger_entries(*)")
    .overrideTypes<LedgerPosition[]>();

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
        const navPoints = [...(position.ledger_entries ?? [])]
          .filter((e) => e.nav_per_unit !== null)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((e) => ({ date: formatDate(e.entry_date), nav: Number(e.nav_per_unit) }));
        return (
          <div key={position.id}>
            <LedgerStatement investorName={investor.full_name} position={position} />
            <NavLineChart data={navPoints} />
          </div>
        );
      })}
      {(positions ?? []).length === 0 && (
        <p className="text-sm text-zinc-500">No investments to display yet.</p>
      )}
    </div>
  );
}
