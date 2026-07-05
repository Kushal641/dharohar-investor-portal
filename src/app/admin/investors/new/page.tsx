import Link from "next/link";
import { createInvestor } from "../actions";
import { Field, BUTTON_CLASS } from "@/components/form-controls";

const ERRORS: Record<string, string> = {
  missing: "Investor ID and full name are required.",
  duplicate_code: "That Investor ID is already in use.",
  failed: "Couldn't create the investor. Please try again.",
};

export default async function NewInvestorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-lg">
      <Link href="/admin/investors" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Investor management
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-zinc-900">Add investor</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Creates the investor record only — you can add portal logins on the next screen.
      </p>

      <form action={createInvestor} className="mt-6 space-y-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {ERRORS[error] ?? ERRORS.failed}
          </p>
        )}
        <Field label="Investor ID" name="investorCode" required placeholder="e.g. DCP-0004" />
        <Field label="Full name" name="fullName" required />
        <Field label="Contact email (optional)" name="email" type="email" />
        <Field label="Referral source (optional)" name="referralSource" placeholder="e.g. Dubai Office" />
        <Field label="Date of first investment (optional)" name="firstInvestment" type="date" />
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-zinc-700">
            Internal notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[#f4511e] focus:outline-none focus:ring-1 focus:ring-[#f4511e]"
          />
        </div>
        <button type="submit" className={BUTTON_CLASS}>
          Create investor
        </button>
      </form>
    </div>
  );
}
