"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { CITIES, CUISINES } from "@/lib/constants";
import { BottomSheet } from "./BottomSheet";

const SORTS = [
  ["", "Recommended"],
  ["rating", "Top rated"],
  ["offers", "Best offers"],
  ["price_low", "Price: low to high"],
  ["price_high", "Price: high to low"],
];

type Search = { city?: string; cuisine?: string; q?: string; sort?: string; price?: string; food?: string };

export function FilterSheet({ sp, priceBands }: { sp: Search; priceBands: [string, string][] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const active = [sp.city, sp.cuisine, sp.sort, sp.price, sp.food].filter(Boolean).length;
  const formId = "mobile-filters";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Filters"
        className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-black/10 bg-white"
      >
        <SlidersHorizontal className="h-5 w-5" />
        {active > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
            {active}
          </span>
        )}
      </button>
      <BottomSheet
        open={open}
        onClose={close}
        label="Filters"
        eyebrow="Refine"
        footer={
          <div className="flex gap-3">
            <Link href="/restaurants" onClick={close} className="rounded-xl border border-black/10 px-5 py-3.5 font-semibold">
              Clear
            </Link>
            <button form={formId} className="flex-1 rounded-xl bg-brand-600 py-3.5 font-semibold text-white">
              Show restaurants
            </button>
          </div>
        }
      >
        <form id={formId} action="/restaurants" onSubmit={close} className="space-y-5 pt-2">
          {sp.q && <input type="hidden" name="q" value={sp.q} />}
          <Field label="City">
            <select name="city" defaultValue={sp.city ?? ""} className="w-full rounded-xl border border-black/10 bg-white px-4 py-3">
              <option value="">All cities</option>
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Cuisine">
            <select name="cuisine" defaultValue={sp.cuisine ?? ""} className="w-full rounded-xl border border-black/10 bg-white px-4 py-3">
              <option value="">All cuisines</option>
              {CUISINES.map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Food">
            <Pills name="food" value={sp.food} options={[["", "Any"], ["veg", "Pure veg"], ["nonveg", "Non-veg"]]} />
          </Field>
          <Field label="Sort by">
            <div className="divide-y divide-black/5 rounded-xl border border-black/10 bg-white">
              {SORTS.map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center justify-between px-4 py-3">
                  {label}
                  <input type="radio" name="sort" value={value} defaultChecked={(sp.sort ?? "") === value} className="h-5 w-5 accent-brand-600" />
                </label>
              ))}
            </div>
          </Field>
          <Field label="Price for two">
            <Pills name="price" value={sp.price} options={[["", "Any"], ...priceBands]} />
          </Field>
        </form>
      </BottomSheet>
    </>
  );
}

function Pills({ name, value, options }: { name: string; value?: string; options: string[][] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <label key={v} className="cursor-pointer">
          <input type="radio" name={name} value={v} defaultChecked={(value ?? "") === v} className="peer sr-only" />
          <span className="block rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold">{label}</p>
      {children}
    </div>
  );
}
