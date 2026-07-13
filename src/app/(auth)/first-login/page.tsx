import { completeFirstLogin } from "./actions";
import { PASSWORD_HINT } from "@/lib/password-policy";
import { PasswordField } from "@/components/password-field";

const ERROR_MESSAGES: Record<string, string> = {
  mismatch: "Passwords don't match.",
  update_failed: "Couldn't set your new password. Please try again.",
};

export default async function FirstLoginPage({
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
    <div>
      <p className="mb-4 text-sm text-zinc-600">
        This is your first login. Please set a new password before continuing.
      </p>
      <p className="mb-4 text-xs text-zinc-500">{PASSWORD_HINT}</p>
      <form action={completeFirstLogin} className="space-y-4">
        {errorMessage && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
        )}
        <PasswordField
          label="New password"
          name="password"
          required
          minLength={8}
          maxLength={64}
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm new password"
          name="confirmPassword"
          required
          minLength={8}
          maxLength={64}
          autoComplete="new-password"
        />
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
