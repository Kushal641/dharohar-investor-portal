import Link from "next/link";
import { login } from "./actions";
import { PasswordField } from "@/components/password-field";

const ERROR_MESSAGES: Record<string, string> = {
  missing: "Enter your User ID email and password.",
  invalid: "Incorrect email or password.",
  disabled: "This account has been disabled. Contact the administrator.",
  no_profile: "This account isn't set up yet. Contact the administrator.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <form action={login} className="space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."}
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
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#f4511e] focus:outline-none focus:ring-1 focus:ring-[#f4511e]"
        />
      </div>
      <PasswordField label="Password" name="password" required autoComplete="current-password" />
      <button
        type="submit"
        className="w-full rounded-md bg-[#f4511e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#d8430f]"
      >
        Log in
      </button>
      <p className="text-center text-sm text-zinc-500">
        <Link href="/forgot-password" className="hover:text-zinc-700">
          Forgot your password?
        </Link>
      </p>
      <p className="border-t border-zinc-100 pt-4 text-center text-sm text-zinc-500">
        First time here?{" "}
        <Link href="/activate" className="font-medium text-[#f4511e] hover:text-[#d8430f]">
          Activate your account
        </Link>
      </p>
    </form>
  );
}
