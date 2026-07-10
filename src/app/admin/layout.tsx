import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/portal-shell";
import { ADMIN_NAV_ITEMS } from "@/lib/admin/nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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

  if (!profile || profile.role !== "admin") redirect("/login");

  return (
    <PortalShell sectionLabel="Admin Panel" navItems={ADMIN_NAV_ITEMS}>
      {children}
    </PortalShell>
  );
}
