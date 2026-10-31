"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { FormState } from "@/app/actions";

/**
 * A form for an admin server action that returns FormState: shows its error or success message.
 * Fields keep what was typed when there's an error, and clear after a success.
 */
export function ActionForm({
  action,
  submit,
  className = "",
  children,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  submit: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) ref.current?.reset();
  }, [state]);
  return (
    <form
      ref={ref}
      action={formAction}
      onSubmit={(e) => {
        // Submit by hand: React would otherwise clear every field, even when the server says something's wrong.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className={className}
    >
      {children}
      {state?.error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{state.success}</p>}
      <button
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} {submit}
      </button>
    </form>
  );
}

export const field = "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-500";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
