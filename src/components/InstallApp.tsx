"use client";

import { useEffect, useState } from "react";
import { Download, EllipsisVertical, PlusSquare, Share, X } from "lucide-react";
import { LogoMark } from "./Logo";
import { install, setInstallSheet, useInstall } from "@/lib/install";

/*
 * "Get the app" on phones. CheckInn has no Play Store app; instead the site installs itself to the home screen
 * (manifest.ts, public/sw.js) and opens full screen from its own icon.
 *
 * - A card just under the navbar offers it once, a few seconds in, where the browser can install or the phone is an
 *   iPhone. Closing it keeps it away for two weeks.
 * - The footer's "Install the app" (InstallAppButton) is there any time.
 * - iPhones, and browsers with no install prompt, get a sheet with the steps.
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
  const { prompt, standalone, ios } = useInstall();
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

  const show = ready && !closed && !standalone && (Boolean(prompt) || ios);

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
            onClick={() => {
              close();
              void install();
            }}
            className="shrink-0 rounded-full bg-gold-400 px-4 py-2 text-sm font-bold text-brand-900"
          >
            Install
          </button>
          <button type="button" onClick={close} aria-label="Not now" className="shrink-0 rounded-full p-1.5 text-white/55 transition-colors hover:text-white">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </aside>
      )}
      <InstallSheet />
    </>
  );
}

/** Footer link: phones only, hidden inside the installed app. */
export function InstallAppButton({ className = "" }: { className?: string }) {
  const { standalone } = useInstall();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || standalone) return null;
  return (
    <button type="button" onClick={() => void install()} className={`inline-flex items-center gap-1.5 md:hidden ${className}`}>
      <Download className="h-3.5 w-3.5" aria-hidden />
      Install the app
    </button>
  );
}

/** The steps, for phones where the browser has no install prompt to show. */
function InstallSheet() {
  const { sheetOpen, ios } = useInstall();

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setInstallSheet(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  if (!sheetOpen) return null;
  const steps = ios
    ? [
        { icon: Share, text: <>Tap <b>Share</b> in Safari&apos;s toolbar</> },
        { icon: PlusSquare, text: <>Choose <b>Add to Home Screen</b></> },
        { icon: Download, text: <>Tap <b>Add</b>. CheckInn appears with your apps</> },
      ]
    : [
        { icon: EllipsisVertical, text: <>Open your browser&apos;s <b>menu</b> (⋮)</> },
        { icon: Download, text: <>Tap <b>Install app</b> or <b>Add to Home screen</b></> },
        { icon: PlusSquare, text: <>Confirm. CheckInn appears with your apps</> },
      ];

  return (
    <div className="fixed inset-0 z-80 flex items-end justify-center print:hidden" role="dialog" aria-modal="true" aria-labelledby="checkinn-install-title">
      <button type="button" aria-label="Close" onClick={() => setInstallSheet(false)} className="cpay-backdrop absolute inset-0 bg-brand-900/60" />
      <div className="install-sheet relative w-full max-w-md rounded-t-[24px] bg-cream px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-[13px] bg-brand-900">
            <LogoMark className="h-9 w-9" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="checkinn-install-title" className="font-display text-xl font-bold leading-tight">
              Install CheckInn
            </h2>
            <p className="text-xs text-muted">Free, takes a few seconds, no Play Store needed.</p>
          </div>
          <button type="button" onClick={() => setInstallSheet(false)} aria-label="Close" className="rounded-full p-2 text-muted hover:bg-sand">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <ol className="mt-5 grid gap-2.5">
          {steps.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-sm ring-1 ring-black/5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-ink/85">{text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
