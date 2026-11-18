"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { googleButtonSignIn } from "@/app/actions";

type Gis = {
  accounts: {
    id: {
      initialize: (o: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisLoading: Promise<Gis> | null = null;
/** Google's sign-in script, loaded once. */
function loadGis(): Promise<Gis> {
  const w = window as Window & { google?: Gis };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => (w.google?.accounts?.id ? resolve(w.google) : reject(new Error("Google sign-in didn't load")));
    s.onerror = () => {
      gisLoading = null;
      reject(new Error("Google sign-in didn't load"));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

/**
 * Google's script takes one setup per page, but the sign-in screen keeps both forms mounted: the visible form's
 * button sets `onCredential`, and the one setup passes Google's answer to it.
 */
let gisReady = false;
let onCredential: (credential: string) => void = () => {};

/** Opened from the home-screen icon (the installed app), not in a browser tab. */
const installedApp = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * "Continue with Google". In a browser tab it goes to Google's sign-in page and back (`href`). In the installed app
 * that page would open in Chrome and leave the guest signed in there instead, so the app shows Google's own button:
 * its account picker opens over the app (on Chrome, as a sheet) and hands back an ID token, which the server checks.
 */
export function GoogleSignIn({
  clientId,
  href,
  next,
  signup,
  active,
  className,
  style,
}: {
  clientId: string;
  href: string;
  next: string;
  signup: boolean;
  /** The form on show (the other one is hidden behind the photo panel). */
  active: boolean;
  className: string;
  style?: React.CSSProperties;
}) {
  const [inApp, setInApp] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const slot = useRef<HTMLDivElement>(null);
  const nextRef = useRef(next);
  nextRef.current = next;

  useEffect(() => setInApp(installedApp()), []);

  useEffect(() => {
    if (!inApp || !active || !slot.current) return;
    let cancelled = false;
    onCredential = (credential) => {
      setError(undefined);
      start(async () => {
        const res = await googleButtonSignIn(credential, nextRef.current);
        if (res?.error) setError(res.error);
      });
    };
    loadGis()
      .then((google) => {
        if (cancelled || !slot.current) return;
        if (!gisReady) {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: ({ credential }: { credential: string }) => onCredential(credential),
            ux_mode: "popup",
            use_fedcm_for_button: true,
            itp_support: true,
          });
          gisReady = true;
        }
        slot.current.replaceChildren();
        google.accounts.id.renderButton(slot.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: signup ? "signup_with" : "continue_with",
          logo_alignment: "center",
          width: Math.min(400, Math.round(slot.current.getBoundingClientRect().width) || 320),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [inApp, active, clientId, signup]);

  if (!inApp || failed) {
    return (
      <a href={href} style={style} className={className}>
        <GoogleIcon />
        Continue with Google
      </a>
    );
  }
  return (
    <div style={style} className="auth-f">
      <div ref={slot} className="flex min-h-11 w-full justify-center" aria-busy={pending} />
      {pending && (
        <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Signing you in…
        </p>
      )}
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}
