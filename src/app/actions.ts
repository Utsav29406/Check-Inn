"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { query, transaction } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, safeNext, validBookingToken } from "@/lib/auth";
import { HOLDS_SEAT, PAYMENT_HOLD_MINUTES, buildSlots } from "@/lib/restaurants";
import { paymentMode, upiLink } from "@/lib/payments";
import { sendBookingConfirmation, sendLockoutAlert, sendSignInAlert } from "@/lib/email";
import { BOOKING_LIMIT, LOGIN_LIMIT, clearAttempts, clientIp, recentAttempts, recordAttempt, requestSummary } from "@/lib/limits";
import { PLANS, memberExtraDiscount } from "@/lib/constants";
import { bestCoupon, scratchCard } from "@/lib/offers";
import { getFestival, offerFestival } from "@/lib/festival";
import { addDays, nowInIndia } from "@/lib/time";
import type { Coupon, Restaurant, ScratchReveal } from "@/lib/types";

/** What the booking form needs to show our own UPI QR. */
export interface UpiRequest {
  code: string;
  amount: number;
  upiId: string;
  /** upi://pay link: opens a UPI app on phones; the QR encodes the same link. */
  link: string;
  /** QR code as an SVG string. */
  qr: string;
  holdMinutes: number;
}

export type FormState = { error?: string; success?: string; upi?: UpiRequest } | undefined;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
// Lengths match the database columns, so a long entry gets a message instead of a database error.
const isEmail = (s: string) => s.length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isPhone = (s: string) => /^[+\d][\d\s-]{7,18}$/.test(s) && s.replace(/\D/g, "").length >= 10;
const isName = (s: string) => s.length >= 2 && s.length <= 120;

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const phone = str(fd, "phone");
  const password = str(fd, "password");
  if (!isName(name)) return { error: "Please enter your full name (up to 120 characters)." };
  if (!isEmail(email)) return { error: "Please enter a valid email address." };
  if (phone && !isPhone(phone)) return { error: "Please enter a valid phone number." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const hash = await bcrypt.hash(password, 10);
  const [user] = await query<{ id: number }>(
    `INSERT INTO users (name, email, phone, password_hash) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [name, email, phone || null, hash],
  );
  if (!user) return { error: "An account with this email already exists. Try signing in." };
  await createSession(user.id);
  redirect(safeNext(str(fd, "next")));
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const ip = await clientIp();
  const { perEmail, perIp, minutes } = LOGIN_LIMIT;
  if ((await recentAttempts("login", email, minutes)) >= perEmail || (await recentAttempts("login-ip", ip, minutes)) >= perIp) {
    return { error: `Too many wrong passwords. Please wait ${minutes} minutes and try again, or use Continue with Google.` };
  }
  const [user] = await query<{ id: number; name: string; password_hash: string | null }>(
    "SELECT id, name, password_hash FROM users WHERE email = $1",
    [email],
  );
  // One message for every failure, so the form doesn't reveal which emails have accounts.
  if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    await Promise.all([recordAttempt("login", email), recordAttempt("login-ip", ip)]);
    if (user && (await recentAttempts("login", email, minutes)) === perEmail) {
      const req = await requestSummary();
      after(() => sendLockoutAlert({ to: email, name: user.name, minutes, ...req }));
    }
    return { error: "Incorrect email or password. If you signed up with Google, use Continue with Google." };
  }
  await clearAttempts("login", email);
  await createSession(user.id);
  const req = await requestSummary();
  after(() => sendSignInAlert({ to: email, name: user.name, method: "Email and password", ...req }));
  redirect(safeNext(str(fd, "next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

class BookingError extends Error {}

/** "CI" + 8 characters without look-alikes (0/O, 1/I): about a trillion codes, so they can't be guessed. */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newBookingCode = () => `CI${Array.from(randomBytes(8), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("")}`;

export async function createBooking(_: FormState, fd: FormData): Promise<FormState> {
  const restaurantId = Number(fd.get("restaurantId"));
  const date = str(fd, "date");
  const slot = str(fd, "slot");
  const guests = Number(fd.get("guests"));
  const name = str(fd, "name");
  const phone = str(fd, "phone");
  const email = str(fd, "email");
  const request = str(fd, "request").slice(0, 500);
  const couponCode = str(fd, "coupon");

  if (!Number.isInteger(restaurantId) || restaurantId < 1) return { error: "This restaurant no longer exists." };
  if (!slot) return { error: "Please pick a time slot." };
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) return { error: "Guests must be between 1 and 20." };
  if (!isName(name)) return { error: "Please enter the name for the reservation (up to 120 characters)." };
  if (!isPhone(phone)) return { error: "Please enter a valid phone number." };
  if (email && !isEmail(email)) return { error: "Please enter a valid email address." };

  const now = nowInIndia();
  // A real date round-trips through addDays unchanged, so impossible ones like 2026-02-31 are caught too.
  const realDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && addDays(date, 0) === date;
  if (!realDate || date < now.date || date > addDays(now.date, 30)) {
    return { error: "Please choose a date within the next 30 days." };
  }

  // Limits against scripted bookings: per connection per hour, upcoming tables per phone, bookings per email per day.
  const ip = await clientIp();
  const { perIpHour, upcomingPerPhone, perEmailDay } = BOOKING_LIMIT;
  if ((await recentAttempts("booking-ip", ip, 60)) >= perIpHour) {
    return { error: "Too many bookings from this connection. Please try again in an hour." };
  }
  const [{ upcoming }] = await query<{ upcoming: number }>(
    `SELECT count(*)::int AS upcoming FROM bookings
     WHERE right(regexp_replace(guest_phone, '\\D', '', 'g'), 10) = $1 AND status IN ('confirmed', 'pending') AND booking_date >= $2`,
    [phone.replace(/\D/g, "").slice(-10), now.date],
  );
  if (upcoming >= upcomingPerPhone) {
    return { error: `This phone number already has ${upcoming} upcoming tables. Cancel one from My Bookings to book another.` };
  }
  if (email) {
    const [{ today }] = await query<{ today: number }>(
      "SELECT count(*)::int AS today FROM bookings WHERE lower(guest_email) = lower($1) AND created_at > now() - interval '1 day'",
      [email],
    );
    if (today >= perEmailDay) return { error: "This email address has been used for too many bookings today. Please try again tomorrow." };
  }
  await recordAttempt("booking-ip", ip);

  const [user, festival] = await Promise.all([getCurrentUser(), getFestival()]);
  const mode = paymentMode();
  // Tidy up payments abandoned more than a day ago (they stopped holding seats after 15 minutes).
  await query("UPDATE bookings SET status = 'cancelled' WHERE status = 'pending' AND created_at < now() - interval '1 day'");
  let booking: { code: string; amount: number; restaurant: string; online: boolean };
  try {
    booking = await transaction(async (client) => {
      // Lock the restaurant row so concurrent bookings for it are serialised while we check capacity.
      const {
        rows: [restaurant],
      } = await client.query<Restaurant>("SELECT * FROM restaurants WHERE id = $1 FOR UPDATE", [restaurantId]);
      if (!restaurant) throw new BookingError("This restaurant no longer exists.");
      if (!buildSlots(restaurant).includes(slot)) {
        throw new BookingError("That time slot isn't available.");
      }
      const [h, m] = slot.split(":").map(Number);
      if (date === now.date && h * 60 + m <= now.minutes + 30) {
        throw new BookingError("That slot is too soon — please pick a later time.");
      }

      const { rowCount: closed } = await client.query(
        "SELECT 1 FROM slot_blocks WHERE restaurant_id = $1 AND block_date = $2 AND slot_time = $3",
        [restaurantId, date, slot],
      );
      if (closed) throw new BookingError("This time is closed for booking. Please pick another slot.");

      const {
        rows: [usage],
      } = await client.query<{ seats: number }>(
        `SELECT COALESCE(SUM(guests), 0)::int AS seats FROM bookings
         WHERE restaurant_id = $1 AND booking_date = $2 AND slot_time = $3 AND ${HOLDS_SEAT}`,
        [restaurantId, date, slot],
      );
      const left = restaurant.capacity_per_slot - usage.seats;
      if (guests > left) {
        throw new BookingError(left > 0 ? `Only ${left} seats left at this time.` : "This slot is fully booked.");
      }

      const discount = restaurant.discount_percent + memberExtraDiscount(
        user?.membership_tier,
        user?.membership_expires,
        restaurant.discount_percent,
      );
      const fee = restaurant.booking_fee * guests;
      // The best offer the guest qualifies for is applied automatically (their pick from the form wins if it applies).
      // Coupons are locked after the restaurant row, in the same order every time.
      const best = await bestCoupon(client, { userId: user?.id ?? null, phone, guests, fee, festival: offerFestival(festival) }, couponCode);
      const coupon = best && { id: best.coupon.id, code: best.coupon.code, discount: best.discount };
      const amount = fee - (coupon?.discount ?? 0);
      const online = mode !== "venue" && amount > 0;
      // A code clash is near impossible, but would otherwise crash the booking: try a fresh code instead.
      for (let attempt = 0; attempt < 5; attempt++) {
        const {
          rows: [row],
        } = await client.query<{ code: string }>(
          `INSERT INTO bookings
            (code, restaurant_id, user_id, guest_name, guest_phone, guest_email, booking_date, slot_time, guests,
             special_request, discount_percent, status, fee_per_guest, amount, payment_status, coupon_id, coupon_code, coupon_discount)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           ON CONFLICT (code) DO NOTHING RETURNING code`,
          [
            newBookingCode(), restaurantId, user?.id ?? null, name, phone, email || null, date, slot, guests, request || null, discount,
            online ? "pending" : "confirmed", restaurant.booking_fee, amount, online ? "pending" : amount > 0 ? "due" : "none",
            coupon?.id ?? null, coupon?.code ?? null, coupon?.discount ?? 0,
          ],
        );
        if (row) {
          return { code: row.code, amount, restaurant: restaurant.name, online };
        }
      }
      throw new Error("Couldn't create a unique booking code");
    });
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }

  if (booking.online) {
    const link = upiLink(booking.amount, `CheckInn ${booking.code}`);
    const qr = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#061f19", light: "#ffffff" } });
    return {
      upi: { code: booking.code, amount: booking.amount, upiId: process.env.UPI_ID!, link, qr, holdMinutes: PAYMENT_HOLD_MINUTES },
    };
  }
  after(() => sendBookingConfirmation(booking.code));
  revalidatePath("/bookings");
  redirect(`/bookings/${booking.code}`);
}

/**
 * The guest paid by UPI QR and entered the UTR: confirm the table now; an admin checks the UTR against the bank
 * statement later (/admin/payments).
 */
export async function submitUtr(code: string, utr: string): Promise<FormState> {
  const clean = utr.replace(/\s/g, "");
  if (!/^\d{12}$/.test(clean)) return { error: "Enter the 12-digit UTR (UPI reference number) shown in your payment app." };
  let outcome: "confirmed" | "gone" | "full";
  try {
    outcome = await transaction(async (client) => {
      const {
        rows: [b],
      } = await client.query<{ restaurant_id: number; booking_date: string; slot_time: string; guests: number; status: string; payment_status: string }>(
        "SELECT restaurant_id, booking_date, slot_time, guests, status, payment_status FROM bookings WHERE code = $1 FOR UPDATE",
        [code],
      );
      if (!b || b.status !== "pending" || b.payment_status !== "pending") return "gone";
      // The seat hold may have run out while they were paying: check the slot still has room (same lock as createBooking).
      const {
        rows: [r],
      } = await client.query<{ capacity_per_slot: number }>("SELECT capacity_per_slot FROM restaurants WHERE id = $1 FOR UPDATE", [b.restaurant_id]);
      const {
        rows: [u],
      } = await client.query<{ seats: number }>(
        `SELECT COALESCE(SUM(guests), 0)::int AS seats FROM bookings
         WHERE restaurant_id = $1 AND booking_date = $2 AND slot_time = $3 AND code <> $4 AND ${HOLDS_SEAT}`,
        [b.restaurant_id, b.booking_date, b.slot_time, code],
      );
      const { rowCount: closed } = await client.query(
        "SELECT 1 FROM slot_blocks WHERE restaurant_id = $1 AND block_date = $2 AND slot_time = $3",
        [b.restaurant_id, b.booking_date, b.slot_time],
      );
      const fits = !closed && u.seats + b.guests <= r.capacity_per_slot;
      // Either way the UTR is kept, so an admin can match the payment (and refund it if the table was lost).
      await client.query("UPDATE bookings SET status = $2, payment_status = 'review', utr = $3 WHERE code = $1", [code, fits ? "confirmed" : "cancelled", clean]);
      return fits ? "confirmed" : "full";
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "This UTR has already been used for another booking." };
    throw e;
  }
  if (outcome === "gone") return { error: "This booking was released. Close this window and book again." };
  if (outcome === "full") {
    return { error: `Sorry, this time filled up while you were paying. We've saved your UTR ${clean} and will refund you. Please pick another time.` };
  }
  after(() => sendBookingConfirmation(code));
  revalidatePath("/bookings");
  redirect(`/bookings/${code}`);
}

/** The guest closed the UPI QR without paying: free the seats straight away. */
export async function releaseBooking(code: string) {
  await query("UPDATE bookings SET status = 'cancelled' WHERE code = $1 AND status = 'pending' AND payment_status = 'pending'", [code]);
}

/** The booking's owner, or anyone with the signed link from the confirmation email, can cancel an upcoming table. */
export async function cancelBooking(fd: FormData) {
  const code = str(fd, "code");
  const viaEmail = validBookingToken(code, str(fd, "t"));
  const user = await getCurrentUser();
  if (!user && !viaEmail) redirect(`/login?next=/bookings/${code}`);
  // Same rule as canCancel(): only before the table's time, and not once the fee has been paid.
  const now = nowInIndia();
  await query(
    `UPDATE bookings SET status = 'cancelled'
     WHERE code = $1 AND status = 'confirmed' AND payment_status <> 'paid'
       AND (booking_date > $2 OR (booking_date = $2 AND slot_time > make_time($5, $6, 0)))
       AND ($3::boolean OR user_id = $4)`,
    [code, now.date, viaEmail, user?.id ?? null, Math.floor(now.minutes / 60), now.minutes % 60],
  );
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${code}`);
}

/** An offer as the booking form sees it, to show and apply it automatically. */
export type CouponPreview = Pick<Coupon, "code" | "title" | "kind" | "value" | "max_discount" | "min_guests">;

/** Scratches one of the signed-in guest's cards. */
export async function scratchMyCard(cardId: number): Promise<{ reveal?: ScratchReveal; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const reveal = await scratchCard(cardId, user.id, offerFestival(await getFestival()));
  if (!reveal) return { error: "This card isn't available yet: it unlocks once the booking fee is paid (or its booking was cancelled)." };
  revalidatePath("/offers");
  return { reveal };
}

export async function joinMembership(fd: FormData) {
  const tier = str(fd, "tier");
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/membership");
  if (!PLANS.some((p) => p.tier === tier)) redirect("/membership");
  // No payment gateway yet — membership is activated immediately for one year.
  await query(
    "UPDATE users SET membership_tier = $1, membership_expires = ((now() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 year')::date WHERE id = $2",
    [tier, user.id],
  );
  revalidatePath("/", "layout");
  redirect("/membership?joined=1");
}

export async function submitPartner(_: FormState, fd: FormData): Promise<FormState> {
  const restaurantName = str(fd, "restaurantName");
  const contactName = str(fd, "contactName");
  const phone = str(fd, "phone");
  const email = str(fd, "email");
  const city = str(fd, "city");
  const message = str(fd, "message").slice(0, 1000);
  if (restaurantName.length < 2 || contactName.length < 2 || !city) return { error: "Please fill in all required fields." };
  if (restaurantName.length > 140 || contactName.length > 120 || city.length > 60) return { error: "Please shorten the restaurant, contact or city name." };
  if (!isPhone(phone)) return { error: "Please enter a valid phone number." };
  if (!isEmail(email)) return { error: "Please enter a valid email address." };
  await query(
    "INSERT INTO partner_requests (restaurant_name, contact_name, phone, email, city, message) VALUES ($1, $2, $3, $4, $5, $6)",
    [restaurantName, contactName, phone, email, city, message || null],
  );
  return { success: "Thanks! Our partnerships team will reach out within 2 business days." };
}
