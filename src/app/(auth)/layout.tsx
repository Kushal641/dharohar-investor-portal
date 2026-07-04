export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium tracking-wide text-zinc-500">DHAROHAR CAPITAL PARTNERS</p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900">Investor Portal</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
