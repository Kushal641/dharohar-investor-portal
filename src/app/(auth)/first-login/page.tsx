import { completeFirstLogin } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  too_short: "Password must be at least 8 characters.",
  mismatch: "Passwords don't match.",
  update_failed: "Couldn't set your new password. Please try again.",
};

export default async function FirstLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-600">
        This is your first login. Please set a new password before continuing.
      </p>
      <form action={completeFirstLogin} className="space-y-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."}
          </p>
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
          className="w-full rounded-md bg-[#f4511e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#d8430f]"
        >
          Set password and continue
        </button>
      </form>
    </div>
  );
}
