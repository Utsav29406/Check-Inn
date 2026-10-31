"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { CITIES } from "@/lib/constants";

/** "Dining in <city>" button backed by a native select, so phones show their own picker. */
export function CityPicker({ city }: { city: string }) {
  const router = useRouter();
  return (
    <label className="relative block">
      <span className="block text-[11px] text-muted">Dining in</span>
      <span className="flex items-center gap-1 text-base font-bold">
        {city} <ChevronDown className="h-4 w-4 text-brand-600" />
      </span>
      <select
        aria-label="City"
        value={city}
        onChange={(e) => router.push(`/?city=${encodeURIComponent(e.target.value)}`)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {CITIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    </label>
  );
}
