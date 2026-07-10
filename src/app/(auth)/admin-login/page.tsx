import { adminLogin } from "./actions";
import { INPUT_CLASS, BUTTON_CLASS } from "@/components/form-controls";

const ERROR_MESSAGES: Record<string, string> = {
  missing: "Enter your email and password.",
  invalid: "Incorrect email or password.",
  session_expired: "Your session expired. Please log in again.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <p className="mb-4 text-center text-xs font-medium tracking-wide text-zinc-400">
        ADMINISTRATOR ACCESS
      </p>
      <form action={adminLogin} className="space-y-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."}
          </p>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={INPUT_CLASS}
          />
        </div>
        <button type="submit" className={`${BUTTON_CLASS} w-full`}>
          Log in
        </button>
      </form>
    </div>
  );
}
