"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { BUTTON_CLASS } from "@/components/form-controls";

// The "Sync now" button submits a server action that blocks until the whole
// sync finishes, then redirects — useFormStatus gives us a pending flag for
// that entire window, so the button can show a spinner instead of just
// sitting there looking unresponsive.
export function SyncButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={BUTTON_CLASS} disabled={disabled || pending}>
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 animate-spin-fast rounded-full border-2 border-white/40 border-t-white" />
          Syncing…
        </span>
      ) : (
        "Sync now"
      )}
    </button>
  );
}

// Ticks up a "Xs elapsed" counter — for the person who triggered the sync
// (the browser tab is already blocked waiting on it) and for anyone else
// with the page open while a scheduled/cron sync or another admin's sync is
// running.
function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span>{seconds}s elapsed</span>;
}

// Auto-refreshes the page every few seconds while a run is "running", so
// nobody has to hit F5 to find out whether it's done — covers a scheduled
// sync, or one someone else triggered, showing up on a page you already
// have open.
function AutoRefreshWhileRunning({ isRunning }: { isRunning: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [isRunning, router]);

  return null;
}

export function SyncRunningBanner({ startedAt }: { startedAt: string }) {
  return (
    <div className="mt-4 rounded-md bg-blue-50 px-3 py-3 text-sm text-blue-800">
      <AutoRefreshWhileRunning isRunning />
      <div className="flex items-center justify-between">
        <span>Sync in progress…</span>
        <ElapsedTimer startedAt={startedAt} />
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
        <div className="h-full w-1/3 rounded-full bg-blue-500 animate-sync-progress" />
      </div>
    </div>
  );
}
