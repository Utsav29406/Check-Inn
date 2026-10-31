"use client";

import Link from "next/link";
import { startTransition, useActionState, type CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { login, signup, type FormState } from "@/app/actions";

/** Stagger index for the entrance animation (see .auth-f in globals.css). */
export const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

/** `start` is the stagger index of the first field, so the form animates in after whatever sits above it. */
export function AuthForm({ mode, next, start = 3 }: { mode: "login" | "signup"; next: string; start?: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? login : signup, undefined);
  const isSignup = mode === "signup";
  const field = "auth-f w-full rounded-xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-brand-500";
  const q = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  let i = start;

  return (
    <form
      action={action}
      // Submit by hand so React doesn't clear the fields when the server says something's wrong.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      <input type="hidden" name="next" value={next} />
      {isSignup && <input name="name" placeholder="Full name" autoComplete="name" required className={field} style={stagger(i++)} />}
      <input name="email" type="email" placeholder="Email address" autoComplete="email" required className={field} style={stagger(i++)} />
      {isSignup && (
        <input name="phone" type="tel" placeholder="Mobile number (optional)" autoComplete="tel" className={field} style={stagger(i++)} />
      )}
      <input
        name="password"
        type="password"
        placeholder={isSignup ? "Create a password (min 8 characters)" : "Password"}
        autoComplete={isSignup ? "new-password" : "current-password"}
        required
        className={field}
        style={stagger(i++)}
      />
      {state?.error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{state.error}</p>}
      <button
        disabled={pending}
        style={stagger(i++)}
        className="auth-f flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSignup ? "Create account" : "Sign in"}
      </button>
      <p className="auth-f text-center text-sm text-muted" style={stagger(i++)}>
        {isSignup ? "Already a member? " : "New to CheckInn? "}
        <Link href={`${isSignup ? "/login" : "/signup"}${q}`} className="font-semibold text-brand-600 hover:underline">
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
