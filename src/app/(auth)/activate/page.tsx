import Link from "next/link";
import { requestActivationCode, verifyActivationCode } from "./actions";
import { INPUT_CLASS, BUTTON_CLASS } from "@/components/form-controls";

const ERRORS: Record<string, string> = {
  missing: "Enter your email address.",
  code_missing: "Enter the code from your email.",
  code_invalid: "That code is incorrect or has expired. Request a new one below.",
};

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; email?: string }>;
}) {
  const { error, sent, email } = await searchParams;

  if (sent && email) {
    return (
      <div>
        <p className="rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">
          If <span className="font-medium">{email}</span> is registered with us, a one-time code
          has been sent to it. Enter the code below.
        </p>
        <form action={verifyActivationCode} className="mt-4 space-y-4">
          <input type="hidden" name="email" value={email} />
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {ERRORS[error] ?? "Something went wrong. Please try again."}
            </p>
          )}
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-zinc-700">
              One-time code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder="6-digit code"
              className={`${INPUT_CLASS} tracking-widest`}
            />
          </div>
          <button type="submit" className={`${BUTTON_CLASS} w-full`}>
            Verify code
          </button>
        </form>
        <form action={requestActivationCode} className="mt-4 text-center">
          <input type="hidden" name="email" value={email} />
          <button type="submit" className="text-sm text-zinc-500 hover:text-zinc-700">
            Didn&apos;t receive it? Send a new code
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-600">
        First time here? Enter the email address registered with Dharohar Capital Partners and
        we&apos;ll send you a one-time code. You&apos;ll then choose your password.
      </p>
      <form action={requestActivationCode} className="space-y-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {ERRORS[error] ?? "Something went wrong. Please try again."}
          </p>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={INPUT_CLASS}
          />
        </div>
        <button type="submit" className={`${BUTTON_CLASS} w-full`}>
          Send activation code
        </button>
        <p className="text-center text-sm text-zinc-500">
          <Link href="/login" className="hover:text-zinc-700">
            Already activated? Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
