import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Field, BUTTON_CLASS, INPUT_CLASS } from "@/components/form-controls";
import {
  updateInvestor,
  deleteInvestor,
  createInvestorLogin,
  resetLoginPassword,
  setLoginDisabled,
  deleteLogin,
} from "../../actions";

const ERRORS: Record<string, string> = {
  missing: "Investor ID and full name are required.",
  duplicate_code: "That Investor ID is already in use.",
  failed: "Something went wrong. Please try again.",
  login_missing: "Login email and display name are required.",
  login_password_short: "Temporary password must be at least 8 characters.",
  login_create_failed: "Couldn't create the login (is the email already in use?).",
  reset_failed: "Couldn't reset the password.",
};

const MESSAGES: Record<string, string> = {
  created: "Investor created. You can now add their portal login below.",
  saved: "Changes saved.",
  login_created: "Login created. Share the email + temporary password with the investor — they'll be asked to set their own password on first login.",
  reset_done: "Password reset. Share the temporary password — they'll set a new one on next login.",
};

export default async function EditInvestorPage({
  params,
  searchParams,
}: {
  params: Promise<{ investorId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { investorId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: investor } = await supabase
    .from("investors")
    .select(
      "id, investor_code, full_name, email, date_of_first_investment, notes, is_active, referral_sources(name)",
    )
    .eq("id", investorId)
    .maybeSingle()
    .overrideTypes<{
      id: string;
      investor_code: string;
      full_name: string;
      email: string | null;
      date_of_first_investment: string | null;
      notes: string | null;
      is_active: boolean;
      referral_sources: { name: string } | null;
    }>();

  if (!investor) notFound();

  // Logins for this investor. Email lives in auth.users (not readable via the
  // RLS-scoped client), so fetch it with the service-role client — this page
  // is already admin-gated by the layout.
  const admin = createAdminClient();
  const { data: links } = await admin
    .from("investor_auth_links")
    .select("id, auth_user_id, label")
    .eq("investor_id", investorId);

  // No FK between investor_auth_links and user_profiles (both reference
  // auth.users), so PostgREST can't embed — fetch profiles separately.
  const authIds = (links ?? []).map((l) => l.auth_user_id);
  const { data: profiles } = authIds.length
    ? await admin.from("user_profiles").select("id, display_name, is_disabled").in("id", authIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const loginRows = [];
  for (const link of links ?? []) {
    const { data } = await admin.auth.admin.getUserById(link.auth_user_id);
    const profile = profileById.get(link.auth_user_id);
    loginRows.push({
      ...link,
      email: data.user?.email ?? "(unknown)",
      user_profiles: {
        display_name: profile?.display_name ?? "(no profile)",
        is_disabled: profile?.is_disabled ?? false,
      },
    });
  }

  const back = `/admin/investors/${investorId}/edit`;
  const message = Object.keys(MESSAGES).find((k) => sp[k]);
  const error = sp.error;

  return (
    <div className="max-w-2xl">
      <Link href="/admin/investors" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Investor management
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-zinc-900">
        {investor.full_name}{" "}
        <span className="font-normal text-zinc-500">({investor.investor_code})</span>
      </h2>

      {message && (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {MESSAGES[message]}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERRORS[error] ?? ERRORS.failed}
        </p>
      )}

      {/* ---- Investor details ---- */}
      <form action={updateInvestor} className="mt-6 space-y-4">
        <input type="hidden" name="investorId" value={investor.id} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Investor ID" name="investorCode" required defaultValue={investor.investor_code} />
          <Field label="Full name" name="fullName" required defaultValue={investor.full_name} />
          <Field label="Contact email" name="email" type="email" defaultValue={investor.email ?? ""} />
          <Field
            label="Referral source"
            name="referralSource"
            defaultValue={investor.referral_sources?.name ?? ""}
          />
          <Field
            label="Date of first investment"
            name="firstInvestment"
            type="date"
            defaultValue={investor.date_of_first_investment ?? ""}
          />
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="isActive" defaultChecked={investor.is_active} />
              Active
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-zinc-700">
            Internal notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={investor.notes ?? ""}
            className={INPUT_CLASS}
          />
        </div>
        <button type="submit" className={BUTTON_CLASS}>
          Save changes
        </button>
      </form>

      {/* ---- Logins ---- */}
      <section className="mt-10">
        <h3 className="text-base font-semibold text-zinc-900">Portal logins</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Joint accounts: add a second login — both see the same account.
        </p>

        <div className="mt-4 space-y-3">
          {loginRows.map((login) => (
            <div key={login.id} className="rounded-md border border-zinc-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {login.user_profiles.display_name}
                    {login.user_profiles.is_disabled && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
                        Disabled
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {login.email} — {login.label ?? "Holder"}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <form action={setLoginDisabled}>
                    <input type="hidden" name="authUserId" value={login.auth_user_id} />
                    <input type="hidden" name="back" value={back} />
                    <input
                      type="hidden"
                      name="disable"
                      value={login.user_profiles.is_disabled ? "0" : "1"}
                    />
                    <button type="submit" className="text-zinc-500 hover:text-zinc-700">
                      {login.user_profiles.is_disabled ? "Enable" : "Disable"}
                    </button>
                  </form>
                  <form action={deleteLogin}>
                    <input type="hidden" name="authUserId" value={login.auth_user_id} />
                    <input type="hidden" name="back" value={back} />
                    <button type="submit" className="text-red-500 hover:text-red-700">
                      Delete login
                    </button>
                  </form>
                </div>
              </div>
              <form action={resetLoginPassword} className="mt-3 flex items-end gap-2">
                <input type="hidden" name="authUserId" value={login.auth_user_id} />
                <input type="hidden" name="back" value={back} />
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500">
                    Reset password (new temporary password, min 8 chars)
                  </label>
                  <input
                    name="tempPassword"
                    type="text"
                    minLength={8}
                    required
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-[#f4511e] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-400"
                >
                  Reset
                </button>
              </form>
            </div>
          ))}
          {!loginRows.length && (
            <p className="rounded-md border border-dashed border-zinc-200 px-4 py-4 text-sm text-zinc-400">
              No portal logins yet — this investor cannot log in until one is created.
            </p>
          )}
        </div>

        {/* Add login */}
        <form action={createInvestorLogin} className="mt-6 rounded-md border border-zinc-100 p-4">
          <input type="hidden" name="investorId" value={investor.id} />
          <p className="text-sm font-medium text-zinc-900">Add login</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Login email" name="email" type="email" required />
            <Field label="Display name" name="displayName" required />
            <div>
              <label htmlFor="label" className="block text-sm font-medium text-zinc-700">
                Holder label
              </label>
              <select id="label" name="label" className={INPUT_CLASS}>
                <option>Primary holder</option>
                <option>Joint holder</option>
              </select>
            </div>
            <Field
              label="Temporary password (min 8 chars)"
              name="tempPassword"
              required
              placeholder="They change it on first login"
            />
          </div>
          <button type="submit" className={`${BUTTON_CLASS} mt-4`}>
            Create login
          </button>
        </form>
      </section>

      {/* ---- Danger zone ---- */}
      <section className="mt-10 rounded-md border border-red-100 p-4">
        <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Deletes the investor, all their investment records, and all their logins. Cannot be undone.
        </p>
        <form action={deleteInvestor} className="mt-3">
          <input type="hidden" name="investorId" value={investor.id} />
          <button
            type="submit"
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            Delete investor
          </button>
        </form>
      </section>
    </div>
  );
}
