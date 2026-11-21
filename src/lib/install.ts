"use client";

import { useSyncExternalStore } from "react";

/*
 * Installing CheckInn as an app straight from the browser. Android browsers (Chrome, Edge, Samsung) offer a real install
 * prompt, caught here as beforeinstallprompt. Install buttons show only while there is one: browsers without it
 * (iPhones, or Chrome before it is ready or once the app is installed) get no install option.
 */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

interface InstallState {
  /** The browser's own install prompt, when it has offered one. */
  prompt: PromptEvent | null;
  /** Already running as the installed app. */
  standalone: boolean;
}

const SERVER: InstallState = { prompt: null, standalone: false };
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

/** Runs the browser's own install prompt. */
export async function install() {
  const prompt = state.prompt;
  if (!prompt) return;
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
    // Offered before this script loaded: kept by the <head> script (lib/install-early).
    prompt: (window as Window & { __checkinnInstall?: PromptEvent }).__checkinnInstall ?? null,
  };
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the browser's mini-bar
    set({ prompt: e as PromptEvent });
  });
  window.addEventListener("appinstalled", () => set({ prompt: null, standalone: true }));
}
