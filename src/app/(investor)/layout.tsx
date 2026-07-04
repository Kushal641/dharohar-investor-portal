import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/portal-shell";

export default async function InvestorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Second line of defense — middleware already redirects non-investors away
  // from these routes; RLS is the real, non-bypassable boundary underneath.
  if (!profile || profile.role !== "investor") redirect("/login");

  return (
    <PortalShell
      sectionLabel="Investor Dashboard"
      navItems={[
        { href: "/dashboard", label: "Dashboard" },
        { href: "/account", label: "Account" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
