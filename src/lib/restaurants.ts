import "server-only";
import { query } from "./db";
import { addDays, nowInIndia } from "./time";
import type { Restaurant } from "./types";

export interface RestaurantFilters {
  city?: string;
  cuisine?: string;
  q?: string;
  sort?: string;
  price?: string;
  food?: string;
}

/** Price-for-two bands used by the price filter. */
export const PRICE_BANDS: Record<string, { label: string; min: number; max: number }> = {
  u1000: { label: "Under ₹1,000", min: 0, max: 999 },
  "1000-2500": { label: "₹1,000 – ₹2,500", min: 1000, max: 2500 },
  "2500plus": { label: "₹2,500+", min: 2501, max: 1_000_000 },
};

const SORTS: Record<string, string> = {
  rating: "rating DESC, reviews_count DESC",
  price_low: "price_for_two ASC",
  price_high: "price_for_two DESC",
  offers: "discount_percent DESC, rating DESC",
};

export async function searchRestaurants(f: RestaurantFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  const param = (v: unknown) => `$${params.push(v)}`;
  if (f.city) where.push(`city = ${param(f.city)}`);
  if (f.cuisine) where.push(`cuisines ILIKE ${param(`%${f.cuisine}%`)}`);
  if (f.q) {
    const q = param(`%${f.q}%`);
    where.push(`(name ILIKE ${q} OR cuisines ILIKE ${q} OR area ILIKE ${q})`);
  }
  const band = f.price ? PRICE_BANDS[f.price] : undefined;
  if (band) where.push(`price_for_two BETWEEN ${param(band.min)} AND ${param(band.max)}`);
  if (f.food === "veg" || f.food === "nonveg") where.push(`food_type = ${param(f.food)}`);
  const order = SORTS[f.sort ?? ""] ?? "is_featured DESC, rating DESC";
  return query<Restaurant>(
    `SELECT * FROM restaurants ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order}, reviews_count DESC, id LIMIT 200`,
    params,
  );
}

export const getFeatured = () =>
  query<Restaurant>("SELECT * FROM restaurants WHERE is_featured = TRUE ORDER BY rating DESC, reviews_count DESC, id LIMIT 8");

export const getTopOffers = () =>
  query<Restaurant>("SELECT * FROM restaurants ORDER BY discount_percent DESC, rating DESC, id LIMIT 4");

export const getCityPopular = (city: string, limit = 5) =>
  query<Restaurant>("SELECT * FROM restaurants WHERE city = $1 ORDER BY rating DESC, reviews_count DESC, id LIMIT $2", [city, limit]);

export const getCityOffers = (city: string) =>
  query<Restaurant>(
    "SELECT * FROM restaurants WHERE city = $1 AND discount_percent > 0 ORDER BY discount_percent DESC, rating DESC, id LIMIT 6",
    [city],
  );

export async function getRestaurant(slug: string) {
  const [r] = await query<Restaurant>("SELECT * FROM restaurants WHERE slug = $1", [slug]);
  return r ?? null;
}

export async function getSimilar(r: Restaurant) {
  return query<Restaurant>(
    "SELECT * FROM restaurants WHERE city = $1 AND id <> $2 ORDER BY rating DESC, reviews_count DESC, id LIMIT 3",
    [r.city, r.id],
  );
}

/** Minutes an unpaid booking holds its seats while the guest is on the payment screen. */
export const PAYMENT_HOLD_MINUTES = 15;

/** Bookings that take up seats: confirmed ones, plus recent ones still waiting for payment. */
export const HOLDS_SEAT = `(status = 'confirmed' OR (status = 'pending' AND created_at > now() - interval '${PAYMENT_HOLD_MINUTES} minutes'))`;

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * 30-minute slots between opening and closing (last seating 1 hour before close).
 * During an afternoon break, the last seating is 1 hour before the break starts.
 */
export function buildSlots(r: Pick<Restaurant, "opening_time" | "closing_time" | "break_start" | "break_end">) {
  const start = toMin(r.opening_time);
  let close = toMin(r.closing_time);
  if (close <= start) close += 24 * 60; // closes after midnight
  const end = close - 60;
  const slots: string[] = [];
  const breakFrom = r.break_start ? toMin(r.break_start) - 60 : Infinity;
  const breakTo = r.break_end ? toMin(r.break_end) : -Infinity;
  for (let m = Math.ceil(start / 30) * 30; m <= end && m < 24 * 60; m += 30) {
    if (m > breakFrom && m < breakTo) continue;
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return slots;
}

/** Seats already taken per slot for a given date. */
export async function getSlotUsage(restaurantId: number, date: string) {
  const rows = await query<{ slot: string; seats: number }>(
    `SELECT to_char(slot_time, 'HH24:MI') AS slot, SUM(guests)::int AS seats
     FROM bookings WHERE restaurant_id = $1 AND booking_date = $2 AND ${HOLDS_SEAT}
     GROUP BY slot_time`,
    [restaurantId, date],
  );
  return Object.fromEntries(rows.map((r) => [r.slot, Number(r.seats)]));
}

/** Times an admin has closed for booking on a date. */
export async function getBlockedSlots(restaurantId: number, date: string) {
  const rows = await query<{ slot: string }>(
    "SELECT to_char(slot_time, 'HH24:MI') AS slot FROM slot_blocks WHERE restaurant_id = $1 AND block_date = $2",
    [restaurantId, date],
  );
  return rows.map((r) => r.slot);
}

export interface OpenSlots {
  date: string;
  today: boolean;
  slots: string[];
}

/**
 * The next few bookable times for each restaurant (for a party of two): today if any are left, otherwise tomorrow.
 * One query covers every restaurant in the list.
 */
export async function getOpenSlots(rs: Restaurant[], perRestaurant = 3): Promise<Record<number, OpenSlots>> {
  if (!rs.length) return {};
  const now = nowInIndia();
  const tomorrow = addDays(now.date, 1);
  const rows = await query<{ restaurant_id: number; booking_date: string; slot: string; seats: number }>(
    `SELECT restaurant_id, booking_date, to_char(slot_time, 'HH24:MI') AS slot, SUM(guests)::int AS seats
     FROM bookings
     WHERE restaurant_id = ANY($1::bigint[]) AND booking_date IN ($2, $3) AND ${HOLDS_SEAT}
     GROUP BY 1, 2, 3`,
    [rs.map((r) => r.id), now.date, tomorrow],
  );
  const blocks = await query<{ restaurant_id: number; block_date: string; slot: string }>(
    `SELECT restaurant_id, block_date, to_char(slot_time, 'HH24:MI') AS slot FROM slot_blocks
     WHERE restaurant_id = ANY($1::bigint[]) AND block_date IN ($2, $3)`,
    [rs.map((r) => r.id), now.date, tomorrow],
  );
  const used = new Map(rows.map((x) => [`${x.restaurant_id}|${x.booking_date}|${x.slot}`, x.seats]));
  // A closed slot counts as full.
  for (const b of blocks) used.set(`${b.restaurant_id}|${b.block_date}|${b.slot}`, Infinity);
  const out: Record<number, OpenSlots> = {};
  for (const r of rs) {
    const all = buildSlots(r);
    const pick = (date: string, after: number) =>
      all
        .filter((s) => toMin(s) > after && r.capacity_per_slot - (used.get(`${r.id}|${date}|${s}`) ?? 0) >= 2)
        .slice(0, perRestaurant);
    const today = pick(now.date, now.minutes + 30);
    out[r.id] = today.length
      ? { date: now.date, today: true, slots: today }
      : { date: tomorrow, today: false, slots: pick(tomorrow, -1) };
  }
  return out;
}
