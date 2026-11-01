import "server-only";
import { query } from "./db";

/** Largest photo accepted after the browser has resized it (the listing form sends about 200–400 KB). */
const MAX_BYTES = 1_500_000;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Saves a photo sent from a form as a data: URL and returns the path it's served at (/api/images/<id>).
 * Returns null if it isn't a JPEG, PNG or WebP photo of a sensible size.
 */
export async function savePhoto(dataUrl: string): Promise<string | null> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m || !TYPES.includes(m[1])) return null;
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length < 1000 || bytes.length > MAX_BYTES) return null;
  // Check the file really starts like the image type it claims to be.
  const magic = bytes.subarray(0, 12);
  const ok =
    (m[1] === "image/jpeg" && magic[0] === 0xff && magic[1] === 0xd8) ||
    (m[1] === "image/png" && magic.subarray(1, 4).toString() === "PNG") ||
    (m[1] === "image/webp" && magic.subarray(8, 12).toString() === "WEBP");
  if (!ok) return null;
  const [row] = await query<{ id: number }>("INSERT INTO images (content_type, data) VALUES ($1, $2) RETURNING id", [m[1], bytes]);
  return `/api/images/${row.id}`;
}

const coords = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
    ? { latitude: Math.round(lat * 1e6) / 1e6, longitude: Math.round(lng * 1e6) / 1e6 }
    : null;

/** Coordinates from "23.03, 72.58" or a full Google Maps link (…/@23.03,72.58,…, ?q=23.03,72.58, !3d23.03!4d72.58). */
export function coordsFromText(text: string) {
  const t = decodeURIComponent(text.trim());
  const patterns = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m) return coords(Number(m[1]), Number(m[2]));
  }
  return null;
}

/**
 * The map pin from what an owner or admin entered: coordinates, a Google Maps link, or a short share link
 * (maps.app.goo.gl / goo.gl/maps), which is followed to the full link. Empty input means no pin.
 */
export async function parseLocation(input: string): Promise<{ latitude: number; longitude: number } | null | "invalid"> {
  const text = input.trim();
  if (!text) return null;
  const direct = coordsFromText(text);
  if (direct) return direct;
  if (/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//.test(text)) {
    try {
      let url = text;
      for (let hop = 0; hop < 4; hop++) {
        const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
        const next = res.headers.get("location");
        if (!next) break;
        url = new URL(next, url).toString();
        const found = coordsFromText(url);
        if (found) return found;
      }
    } catch {
      // Fall through: the link couldn't be followed.
    }
  }
  return "invalid";
}

/** The booking fee for a new listing, by its price for two (same tiers as the rest of the site). */
export const feeForPrice = (priceForTwo: number) => (priceForTwo < 1000 ? 98 : priceForTwo < 2000 ? 198 : priceForTwo < 3000 ? 298 : 398);
