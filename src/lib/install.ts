"use client";

import { useSyncExternalStore } from "react";

/*
 * Installing CheckInn as an app from the browser. Android browsers (Chrome, Edge, Samsung) offer a real install prompt,
 * caught here as beforeinstallprompt; iPhones have none, so they get the "Add to Home Screen" steps instead.
 */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

interface InstallState {
  /** The browser's own install prompt, when it has offered one. */
  prompt: PromptEvent | null;
  /** Already running as the installed app. */
  standalone: boolean;
  ios: boolean;
  /** The how-to sheet (iPhone, or a browser without a prompt). */
  sheetOpen: boolean;
}

const SERVER: InstallState = { prompt: null, standalone: false, ios: false, sheetOpen: false };
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

export const setInstallSheet = (open: boolean) => set({ sheetOpen: open });

/** Runs the browser's install prompt if there is one, else opens the how-to sheet. */
export async function install() {
  const prompt = state.prompt;
  if (!prompt) return set({ sheetOpen: true });
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
    ios: /iphone|ipad|ipod/i.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1),
    // Offered before this script loaded: kept by the <head> script (lib/install-early).
    prompt: (window as Window & { __checkinnInstall?: PromptEvent }).__checkinnInstall ?? null,
  };
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the browser's mini-bar
    set({ prompt: e as PromptEvent });
  });
  window.addEventListener("appinstalled", () => set({ prompt: null, standalone: true }));
}
