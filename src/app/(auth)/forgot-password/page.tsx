import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  if (sent) {
    return (
      <p className="rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">
        If that email has an account, a password reset link has been sent. Check your inbox.
      </p>
    );
  }

  return (
    <form action={requestPasswordReset} className="space-y-4">
      <p className="text-sm text-zinc-600">
        Enter your account email and we'll send you a link to reset your password.
      </p>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Enter your email address.</p>
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
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#f4511e] focus:outline-none focus:ring-1 focus:ring-[#f4511e]"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-md bg-[#f4511e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#d8430f]"
      >
        Send reset link
      </button>
    </form>
  );
}
