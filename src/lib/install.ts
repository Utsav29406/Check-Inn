"use client";

import { useSyncExternalStore } from "react";

/*
 * Installing CheckInn as an app straight from the browser, with the browser's own install (beforeinstallprompt, which
 * Android browsers such as Chrome, Edge and Samsung offer). There are no how-to steps: a tap installs directly.
 *
 * Chrome offers its install only once the visitor has tapped the page and spent about 30 seconds on the site, so a tap
 * can come before it is ready. The tap itself counts, so install() then waits a few seconds for the offer and installs
 * as soon as it arrives. If it still doesn't come, a short note says why (already installed, or try again shortly).
 *
 * iPhones and iPads have no install a page can start (Safari keeps "Add to Home Screen" in its own Share menu), so
 * there the button shows a one-line note naming those two taps.
 */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

interface InstallState {
  /** The browser's own install prompt, when it has offered one. */
  prompt: PromptEvent | null;
  /** Already running as the installed app. */
  standalone: boolean;
  /** An Android phone: install buttons show there even before the browser's offer arrives. */
  android: boolean;
  /** An iPhone or iPad: install is Safari's Share → Add to Home Screen. */
  ios: boolean;
  /** Waiting for the browser's offer after a tap. */
  waiting: boolean;
  /** A short note after a tap that couldn't install. */
  notice: string | null;
}

const SERVER: InstallState = { prompt: null, standalone: false, android: false, ios: false, waiting: false, notice: null };
let state = SERVER;
const listeners = new Set<() => void>();
const set = (patch: Partial<InstallState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** How long a tap waits for the browser's offer. A browser lets a page open its install only within ~5 s of a tap. */
const WAIT_MS = 4000;
let noticeTimer: number | undefined;
function note(text: string, ms = 6000) {
  window.clearTimeout(noticeTimer);
  set({ notice: text });
  noticeTimer = window.setTimeout(() => set({ notice: null }), ms);
}

/** The browser's offer, now or within WAIT_MS. */
function offer(): Promise<PromptEvent | null> {
  if (state.prompt) return Promise.resolve(state.prompt);
  return new Promise((resolve) => {
    const t = window.setTimeout(() => {
      unsub();
      resolve(null);
    }, WAIT_MS);
    const unsub = subscribe(() => {
      if (!state.prompt) return;
      window.clearTimeout(t);
      unsub();
      resolve(state.prompt);
    });
  });
}

/** Installed already? Chrome on Android can tell, through the manifest's related_applications. */
async function installedAlready() {
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
  try {
    return Boolean(nav.getInstalledRelatedApps && (await nav.getInstalledRelatedApps()).length);
  } catch {
    return false;
  }
}

/** Installs straight away with the browser's own install. */
export async function install() {
  if (state.waiting) return;
  if (state.ios && !state.prompt) return note("To install, tap Safari's Share button, then Add to Home Screen.", 9000);
  set({ waiting: !state.prompt, notice: null });
  const prompt = await offer();
  set({ waiting: false });
  if (!prompt) {
    note(
      (await installedAlready())
        ? "CheckInn is already installed. Open it from your home screen."
        : "Your browser is still getting the app ready. Tap again in a few seconds.",
    );
    return;
  }
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  // A prompt can be used once; the browser offers a fresh one if it may.
  set({ prompt: null, ...(outcome === "accepted" ? { standalone: true } : {}) });
}

export const useInstall = () => useSyncExternalStore(subscribe, () => state, () => SERVER);

// Listening from the first import: the browser may offer its prompt before any component has mounted.
if (typeof window !== "undefined") {
  const nav = navigator as Navigator & { standalone?: boolean };
  state = {
    ...state,
    standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
    android: /android/i.test(nav.userAgent),
    ios: /iphone|ipad|ipod/i.test(nav.userAgent) || (/macintosh/i.test(nav.userAgent) && nav.maxTouchPoints > 1),
    // Offered before this script loaded: kept by the <head> script (lib/install-early).
    prompt: (window as Window & { __checkinnInstall?: PromptEvent }).__checkinnInstall ?? null,
  };
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the browser's mini-bar
    set({ prompt: e as PromptEvent });
  });
  window.addEventListener("appinstalled", () => set({ prompt: null, standalone: true }));
}
