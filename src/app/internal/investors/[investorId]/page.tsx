import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LedgerStatement, type LedgerPosition } from "@/components/ledger-statement";

export default async function InternalInvestorDetailPage({
  params,
}: {
  params: Promise<{ investorId: string }>;
}) {
  const { investorId } = await params;
  const supabase = await createClient();

  const { data: investor } = await supabase
    .from("investors")
    .select("id, investor_code, full_name")
    .eq("id", investorId)
    .maybeSingle();

  if (!investor) notFound();

  const { data: positions } = await supabase
    .from("investor_vehicle_positions")
    .select("id, current_valuation, valuation_date, investment_vehicles(name), ledger_entries(*)")
    .eq("investor_id", investorId)
    .overrideTypes<LedgerPosition[]>();

  return (
    <div>
      <Link href="/internal/investors" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; All investors
      </Link>
      <p className="mt-4 text-xs text-zinc-500">
        Read-only view — exactly what {investor.full_name} ({investor.investor_code}) sees.
      </p>
      <div className="mt-6 space-y-12">
        {(positions ?? []).map((position) => (
          <LedgerStatement key={position.id} investorName={investor.full_name} position={position} />
        ))}
        {!positions?.length && (
          <p className="text-sm text-zinc-500">No investments recorded for this investor.</p>
        )}
      </div>
    </div>
  );
}
