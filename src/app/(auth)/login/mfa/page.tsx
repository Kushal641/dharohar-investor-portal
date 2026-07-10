import { verifyMfa } from "../actions";
import { INPUT_CLASS, BUTTON_CLASS } from "@/components/form-controls";

const ERROR_MESSAGES: Record<string, string> = {
  missing: "Enter the code from your authenticator app.",
  invalid: "That code is incorrect. Try again.",
  failed: "Couldn't start verification. Log in again.",
};

export default async function LoginMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-600">
        Enter the 6-digit code from your authenticator app to continue.
      </p>
      <form action={verifyMfa} className="space-y-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."}
          </p>
        )}
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-zinc-700">
            Authenticator code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            placeholder="123456"
            className={`${INPUT_CLASS} tracking-widest`}
          />
        </div>
        <button type="submit" className={`${BUTTON_CLASS} w-full`}>
          Verify
        </button>
      </form>
    </div>
  );
}
