"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type EnrollState =
  | { step: "idle" }
  | { step: "showing_qr"; factorId: string; qrCode: string; secret: string }
  | { step: "done" };

export function MfaSetup({ hasVerifiedFactor, factorId }: { hasVerifiedFactor: boolean; factorId: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [state, setState] = useState<EnrollState>({ step: "idle" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message ?? "Couldn't start enrollment.");
      return;
    }
    setState({
      step: "showing_qr",
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verifyEnroll() {
    if (state.step !== "showing_qr") return;
    setBusy(true);
    setError(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: state.factorId,
    });
    if (challengeError || !challenge) {
      setBusy(false);
      setError(challengeError?.message ?? "Couldn't create the challenge.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: state.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("That code is incorrect. Check your authenticator app and try again.");
      return;
    }
    setState({ step: "done" });
    router.refresh();
  }

  async function removeFactor() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }
    router.refresh();
  }

  if (hasVerifiedFactor) {
    return (
      <div className="rounded-md border border-zinc-100 p-4">
        <p className="text-sm text-zinc-800">
          <span className="mr-2 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
            Enabled
          </span>
          Two-factor authentication is active — the authenticator code is required at every admin
          login.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={removeFactor}
          disabled={busy}
          className="mt-3 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Remove two-factor authentication
        </button>
      </div>
    );
  }

  if (state.step === "showing_qr") {
    return (
      <div className="rounded-md border border-zinc-100 p-4">
        <p className="text-sm text-zinc-800">
          1. Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password…).
        </p>
        {/* qr_code from Supabase is an SVG data URI */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.qrCode} alt="TOTP QR code" className="mt-3 h-44 w-44 rounded border border-zinc-200 bg-white p-2" />
        <p className="mt-2 text-xs text-zinc-500">
          Can&apos;t scan? Enter this secret manually: <code className="select-all">{state.secret}</code>
        </p>
        <p className="mt-4 text-sm text-zinc-800">2. Enter the 6-digit code the app shows:</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm tracking-widest focus:border-[#f4511e] focus:outline-none"
          />
          <button
            onClick={verifyEnroll}
            disabled={busy || code.trim().length < 6}
            className="rounded-md bg-[#f4511e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d8430f] disabled:opacity-50"
          >
            Verify &amp; enable
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-zinc-100 p-4">
      <p className="text-sm text-zinc-800">
        <span className="mr-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">Off</span>
        Two-factor authentication adds an authenticator-app code to the admin login (recommended
        by SOP §12.3 — free).
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={startEnroll}
        disabled={busy}
        className="mt-3 rounded-md bg-[#f4511e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d8430f] disabled:opacity-50"
      >
        Set up two-factor authentication
      </button>
    </div>
  );
}
