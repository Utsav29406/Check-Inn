import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { db, query, transaction } from "./db";
import { couponBenefit, couponDiscount } from "./constants";
import { addDays, fmtDate, nowInIndia } from "./time";
import type { Coupon, ScratchReveal } from "./types";

/** Bookings that use up a coupon: cancelling a booking gives its coupon back. */
const USES = (coupon: string) => `SELECT count(*)::int FROM bookings ub WHERE ub.coupon_id = ${coupon} AND ub.status <> 'cancelled'`;

/** A coupon won from a scratch card stops working if the booking that earned the card is cancelled. */
const NOT_VOIDED = `NOT EXISTS (
  SELECT 1 FROM scratch_cards s JOIN bookings sb ON sb.id = s.booking_id WHERE s.coupon_id = c.id AND sb.status = 'cancelled')`;

const lastTen = (phone: string) => phone.replace(/\D/g, "").slice(-10);

type Prize = { weight: number; coupon?: Pick<Coupon, "title" | "kind" | "value" | "max_discount"> };

/** What a scratch card can win. Weights are out of 100. */
export const SCRATCH_PRIZES: Record<string, Prize> = {
  flat25: { weight: 30, coupon: { title: "₹25 off your next table", kind: "flat", value: 25, max_discount: null } },
  flat50: { weight: 25, coupon: { title: "₹50 off your next table", kind: "flat", value: 50, max_discount: null } },
  half: { weight: 15, coupon: { title: "Half-price table booking", kind: "percent", value: 50, max_discount: 150 } },
  free: { weight: 7, coupon: { title: "Free table booking", kind: "percent", value: 100, max_discount: 500 } },
  none: { weight: 23 },
};

/** Diwali prizes: shagun amounts (₹51, ₹101, ₹251) and better odds, while the Diwali theme is on. */
export const DIWALI_PRIZES: Record<string, Prize> = {
  shagun51: { weight: 30, coupon: { title: "Diwali shagun: ₹51 off", kind: "flat", value: 51, max_discount: null } },
  shagun101: { weight: 28, coupon: { title: "Diwali shagun: ₹101 off", kind: "flat", value: 101, max_discount: null } },
  shagun251: { weight: 12, coupon: { title: "Diwali shagun: ₹251 off", kind: "flat", value: 251, max_discount: null } },
  diwalifree: { weight: 10, coupon: { title: "Free Diwali table booking", kind: "percent", value: 100, max_discount: 501 } },
  none: { weight: 20 },
};

export const prizeTable = (festival: string | null) => (festival === "diwali" ? DIWALI_PRIZES : SCRATCH_PRIZES);
/** Days a coupon won from a scratch card stays valid. */
export const SCRATCH_VALID_DAYS = 30;

function drawPrize(prizes: Record<string, Prize>) {
  const entries = Object.entries(prizes);
  let n = randomInt(entries.reduce((sum, [, p]) => sum + p.weight, 0));
  for (const [key, p] of entries) {
    if (n < p.weight) return key;
    n -= p.weight;
  }
  return "none";
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCouponCode = () => `WIN${Array.from(randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("")}`;

/**
 * Checks a coupon for a booking and works out the discount. Given the booking transaction's client, the coupon row
 * is locked so two bookings can't both take its last use.
 */
export async function checkCoupon(
  rawCode: string,
  ctx: { userId: number | null; phone: string; guests: number; fee: number; festival: string | null },
  client?: PoolClient,
): Promise<{ coupon: Coupon; discount: number } | { error: string }> {
  const run = client ?? db();
  const lock = Boolean(client);
  const code = rawCode.trim().toUpperCase();
  const {
    rows: [c],
  } = await run.query<Coupon & { voided: boolean }>(
    `SELECT c.*, NOT (${NOT_VOIDED}) AS voided FROM coupons c WHERE c.code = $1 ${lock ? "FOR UPDATE OF c" : ""}`,
    [code],
  );
  if (!c || !c.active) return { error: `"${code}" isn't a valid coupon code.` };
  if (c.festival && c.festival !== ctx.festival) {
    return { error: `This ${c.festival === "diwali" ? "Diwali" : "festival"} offer isn't running right now.` };
  }
  if (c.valid_until && c.valid_until < nowInIndia().date) return { error: `This coupon expired on ${fmtDate(c.valid_until, { day: "numeric", month: "short" })}.` };
  if (c.user_id && c.user_id !== ctx.userId) {
    return { error: ctx.userId ? "This coupon belongs to another account." : "Sign in to use this coupon. It's saved to your account." };
  }
  if (c.voided) return { error: "This coupon was cancelled along with the booking that earned it." };
  if (ctx.guests < c.min_guests) return { error: `This coupon is for ${c.min_guests} or more guests.` };
  if (ctx.fee <= 0) return { error: "There's no booking fee here to take a coupon off." };

  const {
    rows: [{ count: used }],
  } = await run.query<{ count: number }>(USES("$1"), [c.id]);
  if (c.max_uses && used >= c.max_uses) return { error: "This coupon has already been used up." };
  if (c.once_per_user) {
    const {
      rows: [mine],
    } = await run.query(
      `SELECT 1 FROM bookings WHERE coupon_id = $1 AND status <> 'cancelled'
         AND (user_id = $2 OR right(regexp_replace(guest_phone, '\\D', '', 'g'), 10) = $3) LIMIT 1`,
      [c.id, ctx.userId, lastTen(ctx.phone)],
    );
    if (mine) return { error: "You've already used this coupon." };
  }
  return { coupon: c, discount: couponDiscount(c, ctx.fee) };
}

/** Offers anyone can use: the running festival's first, then newest first. */
export const getPublicOffers = async (festival: string | null, run: Pool | PoolClient = db()) =>
  (await run.query<Coupon>(
    `SELECT c.* FROM coupons c
     WHERE c.is_public AND c.active AND (c.valid_until IS NULL OR c.valid_until >= $1)
       AND (c.festival IS NULL OR c.festival = $2)
       AND (c.max_uses IS NULL OR (${USES("c.id")}) < c.max_uses)
     ORDER BY (c.festival IS NOT NULL) DESC, c.created_at DESC`,
    [nowInIndia().date, festival],
  )).rows;

/**
 * Coupons a guest could apply to a new booking: their unused scratch-card wins, then public offers they haven't
 * used up. Best first.
 */
export async function getUsableCoupons(userId: number | null, festival: string | null, run: Pool | PoolClient = db()) {
  const today = nowInIndia().date;
  // One after another: run may be a transaction's client, which takes one query at a time.
  const mine = userId
    ? (
        await run.query<Coupon>(
          `SELECT c.* FROM coupons c
           WHERE c.user_id = $1 AND c.active AND (c.valid_until IS NULL OR c.valid_until >= $2) AND ${NOT_VOIDED}
             AND (${USES("c.id")}) = 0
           ORDER BY c.valid_until`,
          [userId, today],
        )
      ).rows
    : [];
  const open = await getPublicOffers(festival, run);
  if (!userId) return open;
  const { rows: usedRows } = await run.query<{ coupon_id: number }>(
    "SELECT DISTINCT coupon_id FROM bookings WHERE user_id = $1 AND coupon_id IS NOT NULL AND status <> 'cancelled'",
    [userId],
  );
  const used = new Set(usedRows.map((r) => r.coupon_id));
  return [...mine, ...open.filter((c) => !(c.once_per_user && used.has(c.id)))];
}

/**
 * The offer a booking gets automatically: the guest's pick if it still applies, otherwise whichever usable offer takes
 * the most off. Runs inside the booking transaction; every candidate is locked in id order first, so two bookings
 * can't deadlock or share a coupon's last use.
 */
export async function bestCoupon(
  client: PoolClient,
  ctx: { userId: number | null; phone: string; guests: number; fee: number; festival: string | null },
  preferred?: string,
): Promise<{ coupon: Coupon; discount: number } | null> {
  if (ctx.fee <= 0) return null;
  const candidates = await getUsableCoupons(ctx.userId, ctx.festival, client);
  if (!candidates.length) return null;
  await client.query("SELECT id FROM coupons WHERE id = ANY($1) ORDER BY id FOR UPDATE", [candidates.map((c) => c.id)]);
  const ranked = [...candidates].sort((a, b) => couponDiscount(b, ctx.fee) - couponDiscount(a, ctx.fee));
  const pick = preferred?.trim().toUpperCase();
  if (pick) ranked.sort((a, b) => Number(b.code === pick) - Number(a.code === pick));
  for (const c of ranked) {
    const checked = await checkCoupon(c.code, ctx, client);
    if (!("error" in checked) && checked.discount > 0) return checked;
  }
  return null;
}

/** Adds the scratch card a confirmed booking by a signed-in guest earns (once). */
export async function awardScratchCard(client: PoolClient, bookingCode: string) {
  await client.query(
    `INSERT INTO scratch_cards (user_id, booking_id)
     SELECT user_id, id FROM bookings WHERE code = $1 AND user_id IS NOT NULL AND status = 'confirmed'
     ON CONFLICT (booking_id) DO NOTHING`,
    [bookingCode],
  );
}

interface CardRow {
  id: number;
  prize: string | null;
  booking_code: string;
  booking_date: string;
  restaurant_name: string;
  coupon_code: string | null;
  kind: Coupon["kind"] | null;
  value: number | null;
  max_discount: number | null;
  title: string | null;
  valid_until: string | null;
  used: boolean;
}

export interface ScratchCardView {
  id: number;
  bookingCode: string;
  restaurantName: string;
  /** null until scratched. */
  reveal: ScratchReveal | null;
  used: boolean;
}

function reveal(row: Pick<CardRow, "prize" | "coupon_code" | "kind" | "value" | "max_discount" | "title" | "valid_until">): ScratchReveal | null {
  if (!row.prize) return null;
  if (!row.coupon_code || !row.kind || !row.value) {
    return { won: false, headline: "Better luck next time", detail: "Every table you book brings a new card." };
  }
  return {
    won: true,
    headline: row.title!,
    detail: couponBenefit({ kind: row.kind, value: row.value, max_discount: row.max_discount }),
    code: row.coupon_code,
    validUntil: row.valid_until ? fmtDate(row.valid_until, { day: "numeric", month: "short", year: "numeric" }) : undefined,
  };
}

const CARD_SELECT = `
  SELECT s.id, s.prize, b.code AS booking_code, b.booking_date, r.name AS restaurant_name,
         c.code AS coupon_code, c.kind, c.value, c.max_discount, c.title, c.valid_until,
         COALESCE((${USES("c.id")}) > 0, FALSE) AS used
  FROM scratch_cards s
  JOIN bookings b ON b.id = s.booking_id
  JOIN restaurants r ON r.id = b.restaurant_id
  LEFT JOIN coupons c ON c.id = s.coupon_id`;

const toView = (r: CardRow): ScratchCardView => ({ id: r.id, bookingCode: r.booking_code, restaurantName: r.restaurant_name, reveal: reveal(r), used: r.used });

/** A guest's cards, unscratched first. Cards for cancelled bookings are left out. */
export async function getScratchCards(userId: number) {
  const rows = await query<CardRow>(`${CARD_SELECT} WHERE s.user_id = $1 AND b.status <> 'cancelled' ORDER BY s.scratched_at IS NOT NULL, s.created_at DESC`, [
    userId,
  ]);
  return rows.map(toView);
}

export async function getBookingScratchCard(bookingCode: string, userId: number) {
  const [row] = await query<CardRow>(`${CARD_SELECT} WHERE b.code = $1 AND s.user_id = $2 AND b.status = 'confirmed'`, [bookingCode, userId]);
  return row ? toView(row) : null;
}

/** Scratches a card: draws its prize (once) and creates the coupon it wins. Returns null if the card can't be scratched. */
export async function scratchCard(cardId: number, userId: number, festival: string | null): Promise<ScratchReveal | null> {
  return transaction(async (client) => {
    const {
      rows: [card],
    } = await client.query<{ id: number; prize: string | null; status: string }>(
      `SELECT s.id, s.prize, b.status FROM scratch_cards s JOIN bookings b ON b.id = s.booking_id
       WHERE s.id = $1 AND s.user_id = $2 FOR UPDATE OF s`,
      [cardId, userId],
    );
    if (!card || card.status === "cancelled") return null;
    if (!card.prize) {
      const prizes = prizeTable(festival);
      const prize = drawPrize(prizes);
      const won = prizes[prize].coupon;
      let couponId: number | null = null;
      if (won) {
        for (let attempt = 0; attempt < 5 && !couponId; attempt++) {
          const {
            rows: [row],
          } = await client.query<{ id: number }>(
            `INSERT INTO coupons (code, title, kind, value, max_discount, valid_until, max_uses, once_per_user, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, 1, TRUE, $7) ON CONFLICT (code) DO NOTHING RETURNING id`,
            [newCouponCode(), won.title, won.kind, won.value, won.max_discount, addDays(nowInIndia().date, SCRATCH_VALID_DAYS), userId],
          );
          couponId = row?.id ?? null;
        }
        if (!couponId) throw new Error("Couldn't create a unique coupon code");
      }
      await client.query("UPDATE scratch_cards SET prize = $2, coupon_id = $3, scratched_at = now() WHERE id = $1", [cardId, prize, couponId]);
    }
    const {
      rows: [row],
    } = await client.query<CardRow>(`${CARD_SELECT} WHERE s.id = $1`, [cardId]);
    return reveal(row);
  });
}
