import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isReadOnlyViewer } from "@/lib/admin/guard";
import { DEFAULT_STARTING_PASSWORD } from "@/lib/password-policy";
import { resetTeamPassword, setTeamAccountDisabled, deleteTeamAccount } from "./actions";

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ reset_done?: string; deleted?: string; error?: string }>;
}) {
  const { reset_done, deleted, error } = await searchParams;
  const readOnly = await isReadOnlyViewer();

  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, display_name, role, must_change_password, is_disabled")
    .in("role", ["admin", "founder"])
    .order("display_name");

  const rows = [];
  for (const p of profiles ?? []) {
    const { data } = await admin.auth.admin.getUserById(p.id);
    rows.push({ ...p, email: data.user?.email ?? "(unknown)" });
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">Team accounts</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Admin and Founder accounts, provisioned from the sheet&apos;s Admin Email / Founder Email
        lists on sync. Every new account starts with the default password (
        {DEFAULT_STARTING_PASSWORD}) and must change it on first login. Removing someone from the
        sheet never disables or deletes their account here — use the buttons below for that. Note:
        deleting an account whose email is still in the sheet&apos;s Admin/Founder list will
        re-create it on the next sync — remove the email from the sheet first if it&apos;s meant
        to be permanent.
      </p>

      {reset_done && (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Password reset to the default starting password ({DEFAULT_STARTING_PASSWORD}). Tell them
          to log in with it — they&apos;ll be prompted to set their own password.
        </p>
      )}
      {deleted && (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Account deleted.
        </p>
      )}
      {error === "self" && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          You can&apos;t disable or delete your own account. Ask another admin to do it.
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-md border border-zinc-100">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelf = row.id === viewer?.id;
              return (
                <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">
                    {row.display_name}
                    {isSelf && <span className="ml-2 text-xs font-normal text-zinc-400">(you)</span>}
                    {row.is_disabled && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
                        Disabled
                      </span>
                    )}
                    {!row.is_disabled && row.must_change_password && (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        Default password not changed yet
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">{row.email}</td>
                  <td className="px-4 py-2.5 capitalize text-zinc-600">{row.role}</td>
                  <td className="px-4 py-2.5">
                    {!readOnly && !isSelf && (
                      <div className="flex items-center justify-end gap-3 text-sm">
                        <form action={resetTeamPassword}>
                          <input type="hidden" name="authUserId" value={row.id} />
                          <button type="submit" className="text-zinc-500 hover:text-zinc-700">
                            Reset password
                          </button>
                        </form>
                        <form action={setTeamAccountDisabled}>
                          <input type="hidden" name="authUserId" value={row.id} />
                          <input type="hidden" name="disable" value={row.is_disabled ? "0" : "1"} />
                          <button type="submit" className="text-zinc-500 hover:text-zinc-700">
                            {row.is_disabled ? "Enable" : "Disable"}
                          </button>
                        </form>
                        <form action={deleteTeamAccount}>
                          <input type="hidden" name="authUserId" value={row.id} />
                          <button type="submit" className="text-red-500 hover:text-red-700">
                            Delete
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-400">
                  No admin or founder accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
