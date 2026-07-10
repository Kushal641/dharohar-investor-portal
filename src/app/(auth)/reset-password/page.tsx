import { completePasswordReset } from "./actions";
import { PASSWORD_HINT } from "@/lib/password-policy";

const ERROR_MESSAGES: Record<string, string> = {
  mismatch: "Passwords don't match.",
  update_failed: "Couldn't set your new password. Please request a new reset link.",
  invalid: "This reset link is invalid or has expired. Please request a new one.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; detail?: string }>;
}) {
  const { error, detail } = await searchParams;
  const errorMessage =
    error === "policy" && detail
      ? detail
      : error
        ? (ERROR_MESSAGES[error] ?? "Something went wrong. Please try again.")
        : null;

  return (
    <form action={completePasswordReset} className="space-y-4">
      <p className="text-sm text-zinc-600">Choose a new password for your account.</p>
      <p className="text-xs text-zinc-500">{PASSWORD_HINT}</p>
      {errorMessage && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
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
        Set new password
      </button>
    </form>
  );
}
