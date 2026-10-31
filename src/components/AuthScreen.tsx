"use client";

import { useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { unsplash } from "@/lib/constants";
import { AuthForm, stagger } from "./AuthForm";
import { LogoMark } from "./Logo";
import { SafeImage } from "./SafeImage";

type Mode = "login" | "signup";

const COPY: Record<Mode, { title: string; subtitle: string }> = {
  login: { title: "Welcome back", subtitle: "Sign in to manage your bookings and club perks." },
  signup: { title: "Join CheckInn", subtitle: "Free to join. Book faster and keep all your reservations in one place." },
};

/**
 * Sign in and sign up share this screen (rendered by the (auth) layout, so it stays mounted between the two routes).
 * On desktop the photo panel glides across to cover the inactive form; the active form's fields then animate in.
 */
const ERRORS: Record<string, string> = {
  google: "Google sign-in didn't work. Please try again, or use your email instead.",
  google_cancelled: "Google sign-in was cancelled.",
};

export function AuthScreen({ googleEnabled }: { googleEnabled: boolean }) {
  const mode: Mode = usePathname() === "/signup" ? "signup" : "login";
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const error = ERRORS[params.get("error") ?? ""];
  const googleHref = `/api/auth/google${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  // The first form animates in right away; after a switch it waits for the panel to start moving.
  const initialMode = useRef(mode);
  const switched = useRef(false);
  if (mode !== initialMode.current) switched.current = true;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden lg:h-[calc(100vh-4rem)] lg:min-h-160">
      {/* Phones: the photo returns as a header band above the form */}
      <div className="relative h-52 overflow-hidden bg-ink md:hidden">
        <SafeImage
          src={unsplash("photo-1550966871-3ed3cdb5ed0c", 800)}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${mode === "login" ? "opacity-60" : "opacity-0"}`}
        />
        <SafeImage
          src={unsplash("photo-1414235077428-338989a2e8c0", 800)}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${mode === "signup" ? "opacity-60" : "opacity-0"}`}
        />
        <div className="absolute inset-0 bg-linear-to-t from-brand-900 via-brand-900/30" />
        <p className="absolute inset-x-5 bottom-11 font-display text-2xl font-bold leading-tight text-white">
          {mode === "login" ? (
            <>Every great evening <span className="italic text-gold-300">starts with a table.</span></>
          ) : (
            <>Your table is waiting. <span className="italic text-gold-300">Join the club.</span></>
          )}
        </p>
      </div>
      {(["login", "signup"] as const).map((m) => {
        const active = m === mode;
        return (
          <section
            key={m}
            inert={!active}
            data-enter={active ? "" : undefined}
            style={{ "--base": switched.current ? "380ms" : "80ms" } as React.CSSProperties}
            className={`auth-pane auth-${m} ${active ? "flex" : "hidden lg:flex"} relative -mt-7 items-start justify-center rounded-t-[1.75rem] bg-cream px-5 pt-7 pb-10 md:mt-0 md:items-center md:rounded-none md:bg-transparent md:px-4 md:py-14 lg:absolute lg:inset-y-0 lg:w-1/2 lg:py-0 ${m === "login" ? "lg:right-0" : "lg:left-0"}`}
          >
            <div className="w-full max-w-sm">
              <div className="auth-f hidden md:block" style={stagger(0)}>
                <LogoMark className="h-14 w-14" />
              </div>
              <h1 className="auth-f font-display text-3xl font-bold md:mt-6" style={stagger(1)}>
                {COPY[m].title}
              </h1>
              <p className="auth-f mt-1 mb-8 text-muted" style={stagger(2)}>
                {COPY[m].subtitle}
              </p>
              {active && error && (
                <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              {googleEnabled && (
                <>
                  <a
                    href={googleHref}
                    style={stagger(3)}
                    className="auth-f flex w-full items-center justify-center gap-3 rounded-xl border border-black/15 bg-white py-3 font-semibold text-ink shadow-sm transition hover:border-black/25 hover:bg-sand/40"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </a>
                  <div className="auth-f my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted" style={stagger(4)}>
                    <span className="h-px flex-1 bg-black/10" />
                    or {m === "login" ? "sign in" : "sign up"} with email
                    <span className="h-px flex-1 bg-black/10" />
                  </div>
                </>
              )}
              <AuthForm mode={m} next={next} start={googleEnabled ? 5 : 3} />
            </div>
          </section>
        );
      })}

      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 z-10 hidden w-1/2 overflow-hidden bg-ink transition-transform duration-1000 [transition-timing-function:cubic-bezier(.77,0,.18,1)] lg:block ${mode === "signup" ? "translate-x-full" : ""}`}
      >
        <SafeImage
          src={unsplash("photo-1550966871-3ed3cdb5ed0c", 1400)}
          alt=""
          className={`animate-ken-burns absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${mode === "login" ? "opacity-60" : "opacity-0"}`}
        />
        <SafeImage
          src={unsplash("photo-1414235077428-338989a2e8c0", 1400)}
          alt=""
          className={`animate-ken-burns absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${mode === "signup" ? "opacity-60" : "opacity-0"}`}
        />
        <div className="absolute inset-0 bg-linear-to-t from-brand-900 via-brand-900/40" />
        <Caption show={mode === "login"}>
          Every great evening <span className="italic text-gold-300">starts with a table.</span>
        </Caption>
        <Caption show={mode === "signup"}>
          Your table is waiting. <span className="italic text-gold-300">Join the club.</span>
        </Caption>
      </div>
    </div>
  );
}

function Caption({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <p
      className={`absolute bottom-12 left-12 right-12 font-display text-4xl font-bold leading-tight text-white transition duration-700 ${show ? "translate-y-0 opacity-100 delay-500" : "translate-y-4 opacity-0"}`}
    >
      {children}
    </p>
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
