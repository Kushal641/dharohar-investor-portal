import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  setInternalUserDisabled,
  deleteInternalUser,
  resetInternalUserPassword,
} from "./actions";

const MESSAGES: Record<string, string> = {
  created: "Internal user created. Share the email + temporary password — they'll set their own on first login.",
  deleted: "Internal user deleted.",
  reset_done: "Password reset. Share the temporary password with the user.",
};

const ERRORS: Record<string, string> = {
  password_short: "Temporary password must be at least 8 characters.",
  reset_failed: "Couldn't reset the password.",
  not_internal: "Only internal users can be managed here.",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  // Admin-gated by the layout; service-role client so we can read auth emails.
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, display_name, is_disabled, created_at")
    .eq("role", "internal")
    .order("created_at");

  const users = [];
  for (const profile of profiles ?? []) {
    const { data } = await admin.auth.admin.getUserById(profile.id);
    users.push({ ...profile, email: data.user?.email ?? "(unknown)" });
  }

  const message = Object.keys(MESSAGES).find((k) => sp[k]);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Internal users</h2>
        <Link
          href="/admin/users/new"
          className="rounded-md bg-[#f4511e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d8430f]"
        >
          + Add internal user
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Operations / relationship team accounts — they can view all investors but cannot edit anything.
      </p>

      {message && (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {MESSAGES[message]}
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERRORS[sp.error] ?? "Something went wrong."}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {users.map((user) => (
          <div key={user.id} className="rounded-md border border-zinc-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  {user.display_name}
                  {user.is_disabled && (
                    <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
                      Disabled
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">{user.email}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <form action={setInternalUserDisabled}>
                  <input type="hidden" name="authUserId" value={user.id} />
                  <input type="hidden" name="disable" value={user.is_disabled ? "0" : "1"} />
                  <button type="submit" className="text-zinc-500 hover:text-zinc-700">
                    {user.is_disabled ? "Enable" : "Disable"}
                  </button>
                </form>
                <form action={deleteInternalUser}>
                  <input type="hidden" name="authUserId" value={user.id} />
                  <button type="submit" className="text-red-500 hover:text-red-700">
                    Delete
                  </button>
                </form>
              </div>
            </div>
            <form action={resetInternalUserPassword} className="mt-3 flex items-end gap-2">
              <input type="hidden" name="authUserId" value={user.id} />
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
        {!users.length && (
          <p className="rounded-md border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-400">
            No internal users yet.
          </p>
        )}
      </div>
    </div>
  );
}
