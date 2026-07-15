// SOP v1.1 §15 password policy — same rule for every role (investor,
// internal, admin, founder). Returns null if valid, otherwise a message
// naming the failed condition (§15.2 requires telling the user WHICH
// condition failed).

const MIN_LENGTH = 8;
const MAX_LENGTH = 14;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`;
  if (password.length > MAX_LENGTH) return `Password must be at most ${MAX_LENGTH} characters.`;
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character (e.g. ! @ # $ % & *).";
  }
  return null;
}

export const PASSWORD_HINT = "8–14 characters with an uppercase letter, a lowercase letter, a number, and a special character.";

// Every new account (investor, admin, founder) starts with this password —
// set directly via the Supabase admin API, so it never has to satisfy
// validatePassword() above. must_change_password is always true alongside
// it, forcing a real password to be chosen on first login.
export const DEFAULT_STARTING_PASSWORD = "DCP.AIGF@2026";
