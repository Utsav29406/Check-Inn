"use client";

import { useState } from "react";
import { LocateFixed, Loader2 } from "lucide-react";

/** Reads coordinates out of "23.03, 72.58" or a full Google Maps link, for the preview (the server checks again). */
function previewCoords(text: string) {
  let t = text.trim();
  try {
    t = decodeURIComponent(t);
  } catch {}
  const m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(t) ?? /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(t) ?? /[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(t) ?? /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/.exec(t);
  return m ? `${m[1]},${m[2]}` : null;
}

/**
 * Where the restaurant is: paste a Google Maps link (or coordinates), or use this device's location when filling the
 * form at the restaurant. Shows a small map once the spot is known.
 */
export function LocationField({ name, defaultValue = "" }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();
  const spot = previewCoords(value);
  const shortLink = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//.test(value.trim());

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a Google Maps link, or 23.0396, 72.5660"
          className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-base outline-none focus:border-brand-500 md:text-sm"
        />
        <button
          type="button"
          disabled={locating}
          onClick={() => {
            setError(undefined);
            if (!navigator.geolocation) return setError("This browser can't share its location. Paste a Google Maps link instead.");
            setLocating(true);
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setValue(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
                setLocating(false);
              },
              () => {
                setError("Couldn't get your location. Allow location access, or paste a Google Maps link.");
                setLocating(false);
              },
              { enableHighAccuracy: true, timeout: 15000 },
            );
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold hover:border-brand-500 disabled:opacity-50"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} Use my current location
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">In Google Maps, find the restaurant, tap Share and copy the link. Or tap the button while you&rsquo;re at the restaurant.</p>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      {spot ? (
        <iframe
          title="Map preview"
          src={`https://maps.google.com/maps?q=${spot}&z=16&output=embed`}
          loading="lazy"
          className="mt-3 h-48 w-full rounded-xl border border-black/10"
        />
      ) : (
        shortLink && <p className="mt-2 text-xs text-brand-600">Short link added. We&rsquo;ll find the exact spot when you send the form.</p>
      )}
    </div>
  );
}
