"use client";

import { startTransition, useActionState } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { submitListing, type FormState } from "@/app/actions";
import { CITIES } from "@/lib/constants";
import { LocationField } from "./LocationField";
import { PhotoPicker } from "./PhotoPicker";

const field = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-brand-500 md:text-sm";

/** Restaurant owners list their restaurant here; it goes on the website once an admin approves it. */
export function ListingForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(submitListing, undefined);

  if (state?.success) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-white p-10 text-center shadow-xl ring-1 ring-black/5">
        <CircleCheck className="h-14 w-14 text-emerald-600" />
        <h2 className="mt-4 font-display text-2xl font-bold">Listing sent for approval</h2>
        <p className="mt-2 max-w-md text-muted">{state.success}</p>
      </div>
    );
  }
  return (
    <form
      action={action}
      // Submit by hand so React doesn't clear the fields (and the photo) when the server says something's wrong.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-8 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5 sm:p-8"
    >
      <Section title="Your restaurant">
        <Labelled label="Restaurant name" wide>
          <input name="name" required maxLength={140} className={field} />
        </Labelled>
        <Labelled label="City">
          <select name="city" required defaultValue="" className={field}>
            <option value="" disabled>Choose a city</option>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Labelled>
        <Labelled label="Area">
          <input name="area" required maxLength={100} placeholder="e.g. SG Highway" className={field} />
        </Labelled>
        <Labelled label="Full address" wide>
          <input name="address" required maxLength={255} placeholder="Building, street, landmark" className={field} />
        </Labelled>
        <Labelled label="Location on the map" wide>
          <LocationField name="location" />
        </Labelled>
        <Labelled label="Photo" wide>
          <PhotoPicker name="photo" required />
        </Labelled>
      </Section>

      <Section title="What you serve">
        <Labelled label="Cuisines" wide>
          <input name="cuisines" required maxLength={255} placeholder="e.g. Gujarati, Thali, North Indian" className={field} />
        </Labelled>
        <Labelled label="Price for two (₹)">
          <input name="price_for_two" type="number" inputMode="numeric" min={100} required placeholder="e.g. 1200" className={field} />
        </Labelled>
        <Labelled label="Food">
          <select name="food_type" required defaultValue="" className={field}>
            <option value="" disabled>Choose one</option>
            <option value="veg">Pure veg</option>
            <option value="nonveg">Veg and non-veg</option>
          </select>
        </Labelled>
        <Labelled label="Opens at">
          <input name="opening_time" type="time" required defaultValue="11:00" className={field} />
        </Labelled>
        <Labelled label="Closes at">
          <input name="closing_time" type="time" required defaultValue="23:00" className={field} />
        </Labelled>
        <Labelled label="About the restaurant" wide>
          <textarea name="description" required minLength={20} maxLength={1500} rows={4} placeholder="What makes it special: the food, the setting, signature dishes" className={field} />
        </Labelled>
      </Section>

      <Section title="Your contact details">
        <Labelled label="Your name">
          <input name="owner_name" required maxLength={120} autoComplete="name" className={field} />
        </Labelled>
        <Labelled label="Phone">
          <input name="owner_phone" type="tel" required autoComplete="tel" className={field} />
        </Labelled>
        <Labelled label="Email" wide>
          <input name="owner_email" type="email" required autoComplete="email" className={field} />
        </Labelled>
      </Section>

      {state?.error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{state.error}</p>}
      <div>
        <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Send for approval
        </button>
        <p className="mt-2 text-center text-xs text-muted">We check every listing before it goes live, usually within 2 working days.</p>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-1 font-display text-xl font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Labelled({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
