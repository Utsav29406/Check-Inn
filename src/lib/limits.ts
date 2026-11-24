import "server-only";
import { headers } from "next/headers";
import { query } from "./db";

/** The visitor's IP address (Vercel puts the real one first in x-forwarded-for). */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim().slice(0, 64);
}

/** Roughly where and on what a request came from, for sign-in alerts: "Chrome on Android · Ahmedabad, IN". */
export async function requestSummary() {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const browser = /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Edg\//.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "A browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "an unknown device";
  const city = decodeURIComponent(h.get("x-vercel-ip-city") ?? "");
  const country = h.get("x-vercel-ip-country") ?? "";
  const place = [city, country].filter(Boolean).join(", ");
  return { device: `${browser} on ${os}`, place: place || "Unknown location", ip: await clientIp() };
}

/** How many attempts of this kind for this key in the last `minutes`. */
export async function recentAttempts(kind: string, key: string, minutes: number) {
  const [row] = await query<{ n: number }>(
    "SELECT count(*)::int AS n FROM attempts WHERE kind = $1 AND key = $2 AND created_at > now() - make_interval(mins => $3)",
    [kind, key.slice(0, 200), minutes],
  );
  return row.n;
}

export async function recordAttempt(kind: string, key: string) {
  await query("INSERT INTO attempts (kind, key) VALUES ($1, $2)", [kind, key.slice(0, 200)]);
  await query("DELETE FROM attempts WHERE kind = $1 AND created_at < now() - interval '1 day'", [kind]);
}

export async function clearAttempts(kind: string, key: string) {
  await query("DELETE FROM attempts WHERE kind = $1 AND key = $2", [kind, key.slice(0, 200)]);
}

/**
 * Takes back the latest attempt of this kind for this key: a sign-in that turned out right shouldn't count towards
 * the connection's limit (many phones share one mobile-network IP). Only that one, so a correct sign-in to one's own
 * account can't wipe out the wrong guesses made at other accounts.
 */
export async function forgetLatestAttempt(kind: string, key: string) {
  await query("DELETE FROM attempts WHERE id = (SELECT max(id) FROM attempts WHERE kind = $1 AND key = $2)", [kind, key.slice(0, 200)]);
}

/** True at most once a day per key: for alert emails that wrong guesses could otherwise set off again and again. */
export async function onceADay(kind: string, key: string) {
  if ((await recentAttempts(kind, key, 24 * 60)) > 0) return false;
  await recordAttempt(kind, key);
  return true;
}

/** Sign-in failures allowed per email (and per connection) before a 15-minute lockout. */
export const LOGIN_LIMIT = { perEmail: 5, perIp: 20, minutes: 15 };
/** Bookings allowed per connection per hour, upcoming tables per phone number, and bookings per email per day. */
export const BOOKING_LIMIT = { perIpHour: 10, upcomingPerPhone: 4, perEmailDay: 5 };
