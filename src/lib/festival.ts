import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { query } from "./db";
import { nowInIndia } from "./time";

export interface Festival {
  key: "diwali";
  name: string;
  /** The main day, YYYY-MM-DD. */
  day: string;
  /** Last day the theme and its offers run. */
  ends: string;
  /** Shown only to this browser through the preview link, not to everyone. */
  preview: boolean;
}

export const DIWALI = { key: "diwali", name: "Diwali", day: "2026-11-08", ends: "2026-11-15" } as const;

/** Cookie set by /api/preview so one browser can see the festival theme before it's switched on. */
export const PREVIEW_COOKIE = "checkinn_preview";

/** The admin switch: "on" shows the festival to everyone (until it ends), anything else hides it. */
export async function getFestivalSwitch() {
  try {
    const [row] = await query<{ value: string }>("SELECT value FROM site_settings WHERE key = 'festival'");
    return row?.value === "on" ? "on" : "off";
  } catch {
    return "off"; // site_settings not created yet
  }
}

/** The festival theme for this request: live for everyone, previewed by this browser, or none. */
export const getFestival = cache(async (): Promise<Festival | null> => {
  if (nowInIndia().date > DIWALI.ends) return null;
  if ((await getFestivalSwitch()) === "on") return { ...DIWALI, preview: false };
  const jar = await cookies();
  return jar.get(PREVIEW_COOKIE)?.value === DIWALI.key ? { ...DIWALI, preview: true } : null;
});

/**
 * The festival whose offers and scratch prizes apply. Only the admin switch turns those on: the preview link changes
 * how the site looks for one browser, never what anyone pays.
 */
export const offerFestival = (f: Festival | null) => (f && !f.preview ? f.key : null);

/** Whole days until the main festival day (0 on the day, negative after). */
export function daysUntil(f: Pick<Festival, "day">) {
  const today = nowInIndia().date;
  return Math.round((Date.parse(`${f.day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
}
