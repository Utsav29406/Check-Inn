"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { LogoMark } from "./Logo";
import { install, useInstall } from "@/lib/install";

/*
 * "Get the app" on phones. CheckInn has no Play Store app; instead the site installs itself to the home screen
 * (manifest.ts, public/sw.js) and opens full screen from its own icon.
 *
 * Install always runs the browser's own install, straight from the page, with no how-to steps (lib/install). The
 * options show on Android phones, and on any phone whose browser offers its install:
 * - a card just under the navbar, a few seconds in. Closing it keeps it away for two weeks;
 * - "Install the app" (InstallAppButton) on the phone home screen and the Profile page.
 */

const DISMISS_KEY = "checkinn-install-dismissed";
const QUIET_DAYS = 14;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < QUIET_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function InstallApp() {
  const { prompt, standalone, android, waiting, notice } = useInstall();
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    setClosed(dismissedRecently());
    const t = window.setTimeout(() => setReady(true), 6000);
    return () => window.clearTimeout(t);
  }, []);

  function close() {
    setClosed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }

  const show = ready && !closed && !standalone && (Boolean(prompt) || android);

  return (
    <>
      {show && (
        <aside
          aria-label="Install the CheckInn app"
          className="install-card fixed inset-x-2.5 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] z-45 flex items-center gap-3 rounded-[20px] bg-brand-900/95 p-3 pr-2 text-white shadow-[0_14px_38px_-12px_rgba(6,31,25,0.7)] ring-1 ring-gold-400/40 backdrop-blur-xl md:hidden print:hidden"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-white/10 ring-1 ring-white/10">
            <LogoMark className="h-8 w-8" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[13.5px] font-semibold leading-tight">Get the CheckInn app</b>
            <span className="block text-[11.5px] leading-snug text-white/65">Book tables from your home screen. No Play Store needed.</span>
          </span>
          <button
            type="button"
            onClick={() => void install()}
            disabled={waiting}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold-400 px-4 py-2 text-sm font-bold text-brand-900"
          >
            {waiting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Install
          </button>
          <button type="button" onClick={close} aria-label="Not now" className="shrink-0 rounded-full p-1.5 text-white/55 transition-colors hover:text-white">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </aside>
      )}
      {notice && (
        <p
          role="status"
          className="install-card fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-80 rounded-2xl bg-brand-900 px-4 py-3 text-center text-sm text-white shadow-xl md:hidden"
        >
          {notice}
        </p>
      )}
    </>
  );
}

/**
 * "Install the app": phones only (Android, or wherever the browser offers its install), hidden inside the installed
 * app. Pass children to replace the default label.
 */
export function InstallAppButton({ className = "inline-flex items-center gap-1.5", children }: { className?: string; children?: React.ReactNode }) {
  const { prompt, standalone, android, waiting } = useInstall();
  if ((!prompt && !android) || standalone) return null;
  return (
    <button type="button" onClick={() => void install()} aria-busy={waiting} className={`md:hidden aria-busy:opacity-70 ${className}`}>
      {children ?? (
        <>
          <Download className="h-3.5 w-3.5" aria-hidden />
          Install the app
        </>
      )}
    </button>
  );
}
