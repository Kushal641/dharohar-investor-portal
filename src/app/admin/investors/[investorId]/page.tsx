import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isReadOnlyViewer } from "@/lib/admin/guard";
import { DEFAULT_STARTING_PASSWORD } from "@/lib/password-policy";
import { setLoginDisabled, resetAccess, deleteLogin, addLogin } from "../actions";

export default async function ManageInvestorAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ investorId: string }>;
  searchParams: Promise<{ reset_done?: string; add_login?: string; error?: string }>;
}) {
  const { investorId } = await params;
  const { reset_done, add_login, error } = await searchParams;
  const supabase = await createClient();
  const readOnly = await isReadOnlyViewer();

  const { data: investor } = await supabase
    .from("investors")
    .select("id, investor_code, full_name, email, date_of_first_investment, referral_sources(name)")
    .eq("id", investorId)
    .maybeSingle()
    .overrideTypes<{
      id: string;
      investor_code: string;
      full_name: string;
      email: string | null;
      date_of_first_investment: string | null;
      referral_sources: { name: string } | null;
    }>();

  if (!investor) notFound();

  const admin = createAdminClient();
  const { data: links } = await admin
    .from("investor_auth_links")
    .select("id, auth_user_id, label")
    .eq("investor_id", investorId);

  const authIds = (links ?? []).map((l) => l.auth_user_id);
  const { data: profiles } = authIds.length
    ? await admin
        .from("user_profiles")
        .select("id, display_name, is_disabled, must_change_password")
        .in("id", authIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const loginRows = [];
  for (const link of links ?? []) {
    const { data } = await admin.auth.admin.getUserById(link.auth_user_id);
    const profile = profileById.get(link.auth_user_id);
    loginRows.push({
      ...link,
      email: data.user?.email ?? "(unknown)",
      lastSignIn: data.user?.last_sign_in_at ?? null,
      displayName: profile?.display_name ?? "(no profile)",
      isDisabled: profile?.is_disabled ?? false,
      pendingActivation: profile?.must_change_password ?? false,
    });
  }

  const back = `/admin/investors/${investorId}`;

  return (
    <div className="max-w-2xl">
      <Link href="/admin/investors" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Investor access
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-zinc-900">
        {investor.full_name}{" "}
        <span className="font-normal text-zinc-500">({investor.investor_code})</span>
      </h2>

      {/* Read-only investor data — the Google Sheet is the source of truth. */}
      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 rounded-md border border-zinc-100 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-zinc-500">Referral source</dt>
          <dd className="text-zinc-800">{investor.referral_sources?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Date of first investment</dt>
          <dd className="text-zinc-800">{investor.date_of_first_investment ?? "—"}</dd>
        </div>
        <p className="col-span-full text-xs text-zinc-400">
          Investor details are managed in the Google Sheet and updated by the monthly sync — the
          portal cannot edit them.
        </p>
      </dl>

      {reset_done && (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Password reset to the default starting password ({DEFAULT_STARTING_PASSWORD}). Tell the
          investor to log in with it — they&apos;ll be prompted to set their own password.
        </p>
      )}

      {add_login === "created" && (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Login added with the default starting password ({DEFAULT_STARTING_PASSWORD}). Give the
          investor that password to log in with — they&apos;ll be prompted to set their own.
        </p>
      )}
      {add_login === "existing" && (
        <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          That email is already a login for this investor.
        </p>
      )}
      {add_login === "conflict" && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          That email is already used by a different account — resolve manually before adding it
          here.
        </p>
      )}
      {add_login === "bad_email" && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          That doesn&apos;t look like a valid email address.
        </p>
      )}
      {error === "reset_failed" && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t reset that password. Try again, or check Supabase directly if it keeps
          failing.
        </p>
      )}
      {error === "delete_failed" && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t delete that login. Try Disable instead, or check Supabase directly if it
          keeps failing.
        </p>
      )}

      <section className="mt-8">
        <h3 className="text-base font-semibold text-zinc-900">Portal logins</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Logins are authorized automatically from the sheet&apos;s Primary Email / Secondary
          Email columns on sync, or added manually below — for joint accounts, add one login per
          holder. Every new login starts with the default password ({DEFAULT_STARTING_PASSWORD})
          and must be changed on first use.
        </p>

        <div className="mt-4 space-y-3">
          {loginRows.map((login) => (
            <div key={login.id} className="rounded-md border border-zinc-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {login.displayName}
                    {login.isDisabled && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
                        Disabled
                      </span>
                    )}
                    {!login.isDisabled && login.pendingActivation && (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        Default password not changed yet
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {login.email} — {login.label ?? "Holder"}
                    {login.lastSignIn &&
                      ` · last sign-in ${new Date(login.lastSignIn).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}`}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-3 text-sm">
                    <form action={resetAccess}>
                      <input type="hidden" name="authUserId" value={login.auth_user_id} />
                      <input type="hidden" name="back" value={back} />
                      <button type="submit" className="text-zinc-500 hover:text-zinc-700">
                        Reset access
                      </button>
                    </form>
                    <form action={setLoginDisabled} className="flex items-center gap-2">
                      <input type="hidden" name="authUserId" value={login.auth_user_id} />
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="disable" value={login.isDisabled ? "0" : "1"} />
                      <input
                        name="reason"
                        placeholder="Reason (optional)"
                        className="w-36 rounded-md border border-zinc-200 px-2 py-1 text-xs focus:border-[#f4511e] focus:outline-none"
                      />
                      <button type="submit" className="text-zinc-500 hover:text-zinc-700">
                        {login.isDisabled ? "Enable" : "Disable"}
                      </button>
                    </form>
                    <form action={deleteLogin}>
                      <input type="hidden" name="authUserId" value={login.auth_user_id} />
                      <input type="hidden" name="back" value={back} />
                      <button type="submit" className="text-red-500 hover:text-red-700">
                        Delete
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!loginRows.length && (
            <p className="rounded-md border border-dashed border-zinc-200 px-4 py-4 text-sm text-zinc-400">
              No logins authorized yet — add one below, or add the investor&apos;s email to the
              Google Sheet&apos;s Email column and run a sync.
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-zinc-400">
          Note: deleting a login whose email is still in the sheet will re-authorize it on the
          next sync — remove the email from the sheet first. Use Disable to block access while
          keeping the login.
        </p>

        {!readOnly && (
          <form action={addLogin} className="mt-6 flex flex-wrap items-end gap-3 rounded-md border border-zinc-100 p-4">
            <input type="hidden" name="investorId" value={investor.id} />
            <input type="hidden" name="back" value={back} />
            <div>
              <label className="block text-xs text-zinc-500" htmlFor="add-login-email">
                Add a login — email
              </label>
              <input
                id="add-login-email"
                name="email"
                type="email"
                required
                placeholder="name@example.com"
                className="mt-1 w-64 rounded-md border border-zinc-200 px-2 py-1.5 text-sm focus:border-[#f4511e] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500" htmlFor="add-login-label">
                Holder
              </label>
              <select
                id="add-login-label"
                name="label"
                className="mt-1 rounded-md border border-zinc-200 px-2 py-1.5 text-sm focus:border-[#f4511e] focus:outline-none"
              >
                <option value="Primary holder">Primary holder</option>
                <option value="Joint holder">Joint holder</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
            >
              Add login
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
