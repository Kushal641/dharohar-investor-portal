import { createAdminClient } from "@/lib/supabase/admin";
import { isReadOnlyViewer } from "@/lib/admin/guard";
import { DEFAULT_STARTING_PASSWORD } from "@/lib/password-policy";
import { resetTeamPassword } from "./actions";

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ reset_done?: string }>;
}) {
  const { reset_done } = await searchParams;
  const readOnly = await isReadOnlyViewer();
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
        {DEFAULT_STARTING_PASSWORD}) and must change it on first login.
      </p>

      {reset_done && (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Password reset to the default starting password ({DEFAULT_STARTING_PASSWORD}). Tell them
          to log in with it — they&apos;ll be prompted to set their own password.
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
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                <td className="px-4 py-2.5 font-medium text-zinc-900">
                  {row.display_name}
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
                <td className="px-4 py-2.5 text-right">
                  {!readOnly && (
                    <form action={resetTeamPassword}>
                      <input type="hidden" name="authUserId" value={row.id} />
                      <button type="submit" className="text-sm font-medium text-zinc-500 hover:text-zinc-700">
                        Reset password
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
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
