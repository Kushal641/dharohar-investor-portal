import Link from "next/link";
import Image from "next/image";
import logo from "../../public/logo.png";
import { logout } from "@/lib/auth/logout-action";

export function PortalShell({
  sectionLabel,
  badge,
  navItems,
  children,
}: {
  sectionLabel: string;
  badge?: string;
  navItems: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-zinc-100">
        <div className="h-1 bg-gradient-to-r from-brand-orange via-brand-blue to-brand-green" />
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="shrink-0">
              <Image src={logo} alt="Dharohar Capital Partners" priority className="h-10 w-auto" />
            </Link>
            <div className="h-8 w-px bg-zinc-200" />
            <p className="text-sm font-semibold text-zinc-900">{sectionLabel}</p>
            {badge && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                {badge}
              </span>
            )}
          </div>
          <nav className="flex items-center gap-5">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-zinc-600 hover:text-zinc-900">
                {item.label}
              </Link>
            ))}
            <form action={logout}>
              <button type="submit" className="text-sm text-zinc-500 hover:text-brand-accent">
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
      <footer className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-1 px-6 py-6 text-xs text-zinc-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Dharohar Capital Partners. All rights reserved.</p>
          <p>Confidential — for authorized investors only.</p>
        </div>
      </footer>
    </div>
  );
}
