"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const COOKIE = "checkinn_welcome";
const SHOW_MS = 4500;

type Welcome = { kind: "signin" | "signup" | "google" | "admin"; name: string };

const TEXT: Record<Welcome["kind"], { title: (n: string) => string; line: string }> = {
  signin: { title: (n) => `Welcome back, ${n}`, line: "You're signed in to CheckInn" },
  google: { title: (n) => `Welcome back, ${n}`, line: "Signed in with Google" },
  signup: { title: (n) => `Welcome to CheckInn, ${n}`, line: "Your account is ready. Happy dining!" },
  admin: { title: (n) => `Hello, ${n}`, line: "You're signed in to the admin panel" },
};

/** Reads the one-time cookie the server sets on sign-in and shows an animated welcome card. */
function takeWelcome(): Welcome | null {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
  try {
    const w = JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1)));
    return w && w.kind in TEXT && typeof w.name === "string" ? w : null;
  } catch {
    return null;
  }
}

export function WelcomeToast() {
  const pathname = usePathname();
  const [welcome, setWelcome] = useState<Welcome | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Sign-in finishes with a redirect, so check on every page change, not only on first load.
  useEffect(() => {
    const w = takeWelcome();
    if (w) {
      setLeaving(false);
      setWelcome(w);
    }
  }, [pathname]);

  useEffect(() => {
    if (!welcome) return;
    const hide = setTimeout(() => setLeaving(true), SHOW_MS);
    return () => clearTimeout(hide);
  }, [welcome]);

  if (!welcome) return null;
  const text = TEXT[welcome.kind];
  const initial = (welcome.name.trim()[0] ?? "C").toUpperCase();

  return (
    <div className="welcome-toast-wrap pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 sm:justify-end sm:px-6">
      <button
        type="button"
        role="status"
        aria-live="polite"
        onClick={() => setLeaving(true)}
        onAnimationEnd={(e) => e.animationName === "welcome-out" && setWelcome(null)}
        className={`welcome-toast pointer-events-auto relative flex w-full max-w-sm items-center gap-3.5 overflow-hidden rounded-2xl border border-gold-500/30 bg-brand-900 py-3.5 pl-3.5 pr-5 text-left text-white shadow-2xl shadow-brand-900/40 ${leaving ? "is-leaving" : ""}`}
      >
        <span className="welcome-avatar relative grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 font-display text-lg font-semibold text-brand-900">
          {initial}
          <span className="welcome-tick absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-brand-500 ring-2 ring-brand-900">
            <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2.5 6.2 5 8.5l4.5-5" className="welcome-tick-path" />
            </svg>
          </span>
        </span>
        <span className="min-w-0">
          <span className="welcome-title block truncate font-display text-[17px] font-semibold">{text.title(welcome.name)}</span>
          <span className="welcome-line block truncate text-[13px] text-gold-300/90">{text.line}</span>
        </span>
        <span className="welcome-shine pointer-events-none absolute inset-0" aria-hidden />
        <span className="welcome-timer absolute inset-x-0 bottom-0 h-[3px] origin-left bg-gradient-to-r from-gold-400 to-gold-600" style={{ animationDuration: `${SHOW_MS}ms` }} aria-hidden />
      </button>
    </div>
  );
}
