import Link from "next/link";
import { logout } from "@/lib/auth/logout-action";

export function PortalShell({
  sectionLabel,
  navItems,
  children,
}: {
  sectionLabel: string;
  navItems: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-zinc-500">DHAROHAR CAPITAL PARTNERS</p>
            <p className="text-sm font-semibold text-zinc-900">{sectionLabel}</p>
          </div>
          <nav className="flex items-center gap-5">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-zinc-600 hover:text-zinc-900">
                {item.label}
              </Link>
            ))}
            <form action={logout}>
              <button type="submit" className="text-sm text-zinc-500 hover:text-[#f4511e]">
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
