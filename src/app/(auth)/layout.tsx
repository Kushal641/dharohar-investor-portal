import Image from "next/image";
import logo from "../../../public/logo.png";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white">
      <div className="h-1 bg-gradient-to-r from-brand-orange via-brand-blue to-brand-green" />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <Image src={logo} alt="Dharohar Capital Partners" priority className="h-auto w-64" />
            <h1 className="mt-4 text-lg font-semibold text-zinc-900">Investor Portal</h1>
          </div>
          {children}
        </div>
      </div>
      <p className="pb-6 text-center text-xs text-zinc-400">
        © {new Date().getFullYear()} Dharohar Capital Partners. All rights reserved.
      </p>
    </div>
  );
}
