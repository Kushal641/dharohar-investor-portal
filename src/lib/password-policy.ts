// SOP v1.1 §15 password policy. Applies to investor and internal accounts;
// the Administrator follows the stricter §12.3 rule (minimum 14 characters).
// Returns null if valid, otherwise a message naming the failed condition
// (§15.2 requires telling the user WHICH condition failed).

export function validatePassword(password: string, opts?: { isAdmin?: boolean }): string | null {
  const isAdmin = opts?.isAdmin ?? false;
  const min = isAdmin ? 14 : 8;
  const max = isAdmin ? 64 : 14;

  if (password.length < min) return `Password must be at least ${min} characters.`;
  if (password.length > max) return `Password must be at most ${max} characters.`;
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character (e.g. ! @ # $ % & *).";
  }
  return null;
}

export const PASSWORD_HINT = "8–14 characters with an uppercase letter, a lowercase letter, a number, and a special character.";
export const ADMIN_PASSWORD_HINT = "At least 14 characters with an uppercase letter, a lowercase letter, a number, and a special character.";

// Every new account (investor, admin, founder) starts with this password —
// set directly via the Supabase admin API, so it never has to satisfy
// validatePassword() above. must_change_password is always true alongside
// it, forcing a real password to be chosen on first login.
export const DEFAULT_STARTING_PASSWORD = "DCP.AIGF@2026";
