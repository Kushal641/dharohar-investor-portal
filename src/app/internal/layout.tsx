import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/portal-shell";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
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

  if (!profile || !["internal", "admin"].includes(profile.role)) redirect("/login");

  return (
    <PortalShell
      sectionLabel="Internal Dashboard"
      navItems={[{ href: "/internal/investors", label: "Investors" }]}
    >
      {children}
    </PortalShell>
  );
}
