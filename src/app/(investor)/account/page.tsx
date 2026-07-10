import { changePassword } from "./actions";
import { PASSWORD_HINT } from "@/lib/password-policy";

const ERROR_MESSAGES: Record<string, string> = {
  mismatch: "Passwords don't match.",
  update_failed: "Couldn't update your password. Please try again.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; detail?: string }>;
}) {
  const { error, success, detail } = await searchParams;
  const errorMessage =
    error === "policy" && detail
      ? detail
      : error
        ? (ERROR_MESSAGES[error] ?? "Something went wrong. Please try again.")
        : null;

  return (
    <div className="max-w-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Change password</h2>
      <p className="mt-1 text-xs text-zinc-500">{PASSWORD_HINT}</p>
      <form action={changePassword} className="mt-4 space-y-4">
        {errorMessage && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
        )}
        {success && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Password updated.</p>
        )}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#f4511e] focus:outline-none focus:ring-1 focus:ring-[#f4511e]"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#f4511e] focus:outline-none focus:ring-1 focus:ring-[#f4511e]"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-[#f4511e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#d8430f]"
        >
          Update password
        </button>
      </form>
    </div>
  );
}
