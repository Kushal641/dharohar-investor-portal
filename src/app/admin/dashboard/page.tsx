import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [{ count: investorCount }, { data: positions }, { data: latestRun }] = await Promise.all([
    supabase.from("investors").select("id", { count: "exact", head: true }),
    supabase
      .from("investor_vehicle_positions")
      .select("current_valuation, ledger_entries(total_paid_in, sort_order)"),
    supabase
      .from("sync_runs")
      .select("started_at, status")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const totalValue = (positions ?? []).reduce((s, p) => s + (p.current_valuation ?? 0), 0);
  const totalCapital = (positions ?? []).reduce((s, p) => {
    const latest = [...(p.ledger_entries ?? [])].sort((a, b) => b.sort_order - a.sort_order)[0];
    return s + (latest?.total_paid_in ?? 0);
  }, 0);

  const cards = [
    { label: "Total investors", value: String(investorCount ?? 0) },
    { label: "Total capital raised", value: num(totalCapital) },
    { label: "Current portfolio value", value: num(totalValue), accent: true },
  ];

  const links = [
    { href: "/admin/investors", title: "Investor management", desc: "Add, edit, and disable investors; create logins and reset passwords." },
    { href: "/admin/users", title: "Internal users", desc: "Manage the operations / relationship team's read-only accounts." },
    { href: "/admin/sync", title: "Data sync", desc: "Run the monthly Google Sheet sync and review its history." },
    { href: "/internal/investors", title: "Reports & charts", desc: "The full internal dashboard — summaries, charts, and investor drill-down." },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">Portfolio overview</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-md border border-zinc-100 p-4">
            <p className="text-xs text-zinc-500">{card.label}</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${card.accent ? "text-[#f4511e]" : "text-zinc-900"}`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {latestRun && (
        <p className="mt-4 text-xs text-zinc-500">
          Last sync:{" "}
          {new Date(latestRun.started_at).toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          — {latestRun.status.replace("_", " ")}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md border border-zinc-100 p-5 transition-colors hover:border-[#f4511e]"
          >
            <p className="text-sm font-semibold text-zinc-900">{link.title}</p>
            <p className="mt-1 text-xs text-zinc-500">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
