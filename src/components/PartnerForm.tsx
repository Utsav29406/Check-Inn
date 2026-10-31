"use client";

import { startTransition, useActionState } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { submitPartner, type FormState } from "@/app/actions";
import { CITIES } from "@/lib/constants";

export function PartnerForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(submitPartner, undefined);
  const field = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-brand-500";

  if (state?.success) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-white p-10 text-center shadow-xl ring-1 ring-black/5">
        <CircleCheck className="h-14 w-14 text-emerald-600" />
        <h2 className="mt-4 font-display text-2xl font-bold">Request received</h2>
        <p className="mt-2 text-muted">{state.success}</p>
      </div>
    );
  }
  return (
    <form
      action={action}
      // Submit by hand so React doesn't clear the fields when the server says something's wrong.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="grid gap-4 rounded-3xl bg-white p-8 shadow-xl ring-1 ring-black/5 sm:grid-cols-2"
    >
      <input name="restaurantName" placeholder="Restaurant name *" required className={`${field} sm:col-span-2`} />
      <input name="contactName" placeholder="Your name *" required className={field} />
      <select name="city" required defaultValue="" className={field}>
        <option value="" disabled>City *</option>
        {CITIES.map((c) => <option key={c}>{c}</option>)}
        <option>Other</option>
      </select>
      <input name="phone" type="tel" placeholder="Phone *" required className={field} />
      <input name="email" type="email" placeholder="Email *" required className={field} />
      <textarea name="message" rows={3} placeholder="Tell us about your restaurant" className={`${field} sm:col-span-2`} />
      {state?.error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 sm:col-span-2">{state.error}</p>}
      <button disabled={pending} className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:col-span-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Get in touch
      </button>
    </form>
  );
}
