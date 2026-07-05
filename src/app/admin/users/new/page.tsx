import Link from "next/link";
import { createInternalUser } from "../actions";
import { Field, BUTTON_CLASS } from "@/components/form-controls";

const ERRORS: Record<string, string> = {
  missing: "Email and display name are required.",
  password_short: "Temporary password must be at least 8 characters.",
  create_failed: "Couldn't create the user (is the email already in use?).",
};

export default async function NewInternalUserPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-lg">
      <Link href="/admin/users" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Internal users
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-zinc-900">Add internal user</h2>

      <form action={createInternalUser} className="mt-6 space-y-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {ERRORS[error] ?? ERRORS.create_failed}
          </p>
        )}
        <Field label="Email" name="email" type="email" required />
        <Field label="Display name" name="displayName" required />
        <Field
          label="Temporary password (min 8 chars)"
          name="tempPassword"
          required
          placeholder="They change it on first login"
        />
        <button type="submit" className={BUTTON_CLASS}>
          Create internal user
        </button>
      </form>
    </div>
  );
}
