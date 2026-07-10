import { createClient } from "@/lib/supabase/server";
import { MfaSetup } from "./mfa-setup";
import { ADMIN_PASSWORD_HINT } from "@/lib/password-policy";

export default async function AdminSecurityPage() {
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp.find((f) => f.status === "verified") ?? null;
  const anyFactor = factors?.totp[0] ?? null;

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-zinc-900">Admin security</h2>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-zinc-900">Two-factor authentication</h3>
        <div className="mt-3">
          <MfaSetup hasVerifiedFactor={Boolean(verified)} factorId={(verified ?? anyFactor)?.id ?? null} />
        </div>
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-semibold text-zinc-900">Password rules for this account</h3>
        <p className="mt-2 rounded-md border border-zinc-100 p-4 text-sm text-zinc-600">
          {ADMIN_PASSWORD_HINT} Use the &quot;forgot password&quot; flow on the admin login page to
          change it.
        </p>
      </section>
    </div>
  );
}
