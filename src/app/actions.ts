"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db, query, transaction } from "@/lib/db";
import { createSession, destroySession, setWelcome, getCurrentUser, safeNext, validBookingToken } from "@/lib/auth";
import { HOLDS_SEAT, PAYMENT_HOLD_MINUTES, buildSlots } from "@/lib/restaurants";
import { upiDemo, upiEnabled, upiId, upiLink } from "@/lib/payments";
import { TEST, UPI_APPS, upiPayLink, cardBrand, cardDeclined, cardProblem, digits, upiDeclined, upiValid } from "@/lib/checkinnpay";
import { sendBookingConfirmation, sendCancellationEmails, sendListingReceived, sendLockoutAlert, sendMembershipDecision, sendMembershipPaymentReceived, sendSignInAlert } from "@/lib/email";
import { BOOKING_LIMIT, LOGIN_LIMIT, clearAttempts, clientIp, recentAttempts, recordAttempt, requestSummary } from "@/lib/limits";
import { CITIES, PLANS, memberExtraDiscount } from "@/lib/constants";
import { parseLocation, savePhoto } from "@/lib/images";
import { findOrCreateGoogleUser, googleConfig, verifyGoogleCredential } from "@/lib/google";
import { awardScratchCard, bestCoupon, scratchCard } from "@/lib/offers";
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
  /** Demo mode: paid in CheckInn Pay (the demo gateway) rather than real UPI. */
  demo: boolean;
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
  await setWelcome("signup", name);
  redirect(safeNext(str(fd, "next")));
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const ip = await clientIp();
  const { perEmail, perIp, minutes } = LOGIN_LIMIT;
  // Each try is counted before the password is checked, so many guesses sent at once can't all slip under the limit.
  await Promise.all([recordAttempt("login", email), recordAttempt("login-ip", ip)]);
  if ((await recentAttempts("login", email, minutes)) > perEmail || (await recentAttempts("login-ip", ip, minutes)) > perIp) {
    return { error: `Too many wrong passwords. Please wait ${minutes} minutes and try again, or use Continue with Google.` };
  }
  const [user] = await query<{ id: number; name: string; password_hash: string | null }>(
    "SELECT id, name, password_hash FROM users WHERE email = $1",
    [email],
  );
  // One message for every failure, so the form doesn't reveal which emails have accounts.
  if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    if (user && (await recentAttempts("login", email, minutes)) === perEmail) {
      const req = await requestSummary();
      after(() => sendLockoutAlert({ to: email, name: user.name, minutes, ...req }));
    }
    return { error: "Incorrect email or password. If you signed up with Google, use Continue with Google." };
  }
  await clearAttempts("login", email);
  await createSession(user.id);
  await setWelcome("signin", user.name);
  const req = await requestSummary();
  after(() => sendSignInAlert({ to: email, name: user.name, method: "Email and password", ...req }));
  redirect(safeNext(str(fd, "next")));
}

/**
 * Sign-in with Google's own button, inside the installed app: Google hands the page an ID token (from its account
 * picker, which stays in the app) instead of taking the visitor away to its sign-in page.
 */
export async function googleButtonSignIn(credential: string, next: string): Promise<FormState> {
  const config = googleConfig();
  if (!config || typeof credential !== "string" || credential.length > 4096) return { error: "Google sign-in isn't available. Please use your email." };
  let profile;
  try {
    profile = await verifyGoogleCredential(credential, config.clientId);
  } catch (e) {
    console.error("Google button sign-in failed:", e);
    return { error: "Google sign-in didn't work. Please try again, or use your email instead." };
  }
  const userId = await findOrCreateGoogleUser(profile);
  await createSession(userId);
  // Sign-in alert to the account's email (the user's own address, which may differ from the Google one if linked).
  const [u] = await query<{ name: string; email: string }>("SELECT name, email FROM users WHERE id = $1", [userId]);
  if (u) {
    await setWelcome("google", u.name);
    const where = await requestSummary();
    after(() => sendSignInAlert({ to: u.email, name: u.name, method: "Continue with Google", ...where }));
  }
  redirect(safeNext(next));
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
  // The guest's choice: pay the fee now (CheckInn Pay, or UPI once a real UPI ID is set) or at the restaurant.
  const payNow = str(fd, "pay") === "now";

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

  const [user, festival] = await Promise.all([getCurrentUser(), getFestival()]);
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
      const online = payNow && amount > 0;
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
  // Counted only once a table is booked, so guests who hit a full slot a few times aren't locked out.
  await recordAttempt("booking-ip", ip);

  if (booking.online) {
    const note = `CheckInn ${booking.code}`;
    // Demo mode: CheckInn Pay's made-up payee, which real UPI apps refuse.
    const link = upiDemo() ? upiPayLink(booking.code, booking.amount, note) : upiLink(booking.amount, note);
    const qr = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#061f19", light: "#ffffff" } });
    return {
      upi: { code: booking.code, amount: booking.amount, upiId: upiId(), link, qr, holdMinutes: PAYMENT_HOLD_MINUTES, demo: upiDemo() },
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

/**
 * CheckInn Pay for a table booking fee: the table was held while the guest paid; a successful payment confirms it,
 * marks the fee paid (which unlocks the scratch card) and sends the confirmation. Only while no real UPI ID is set.
 * The booking code is only ever given to the browser that made the booking.
 */
export async function payBooking(code: string, body: CheckInnPayBody): Promise<{ paid: boolean; error?: string; invalid?: boolean }> {
  if (!upiDemo()) return { paid: false, error: "CheckInn Pay is off. Please pay by UPI." };
  const decided = decideCheckInnPay(body);
  if ("error" in decided) return { paid: false, ...decided };
  const outcome = await transaction(async (client) => {
    const {
      rows: [b],
    } = await client.query<{ status: string; payment_status: string; held: boolean }>(
      `SELECT status, payment_status, created_at > now() - interval '${PAYMENT_HOLD_MINUTES} minutes' AS held FROM bookings WHERE code = $1 FOR UPDATE`,
      [code],
    );
    if (!b || b.status !== "pending" || b.payment_status !== "pending") return "gone";
    // The hold ran out: the seats and offer may have gone to someone else, so release it rather than take the payment.
    if (!b.held) {
      await client.query("UPDATE bookings SET status = 'cancelled' WHERE code = $1", [code]);
      return "expired";
    }
    await client.query("UPDATE bookings SET status = 'confirmed', payment_status = 'paid', payment_ref = $2 WHERE code = $1", [code, decided.ref]);
    await awardScratchCard(client, code);
    return "paid";
  });
  if (outcome === "gone") return { paid: false, error: "This booking was released. Close this window and book again." };
  if (outcome === "expired") return { paid: false, error: `The ${PAYMENT_HOLD_MINUTES}-minute hold on this table ran out, so nothing was charged. Please book again.` };
  after(() => sendBookingConfirmation(code));
  revalidatePath("/bookings");
  return { paid: true };
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
  const cancelled = await query(
    `UPDATE bookings SET status = 'cancelled'
     WHERE code = $1 AND status = 'confirmed' AND payment_status NOT IN ('paid', 'review')
       AND (booking_date > $2 OR (booking_date = $2 AND slot_time > make_time($5, $6, 0)))
       AND ($3::boolean OR user_id = $4)
     RETURNING code`,
    [code, now.date, viaEmail, user?.id ?? null, Math.floor(now.minutes / 60), now.minutes % 60],
  );
  if (cancelled.length) after(() => sendCancellationEmails(code, "guest"));
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

/** What the membership page needs to show CheckInn's UPI checkout for a plan. */
export interface MembershipCheckout {
  id: number;
  plan: string;
  amount: number;
  upiId: string;
  link: string;
  qr: string;
  /** Demo mode: a made-up UPI ID, so no real payment is possible. */
  demo: boolean;
}

/** Whether a member's plan is still running today. */
const activeTier = (u: { membership_tier: string; membership_expires: string | null }) =>
  u.membership_tier !== "none" && Boolean(u.membership_expires && u.membership_expires >= nowInIndia().date) ? u.membership_tier : "none";

/**
 * Join or upgrade the CheckInn Club: opens a payment for the plan's yearly price, paid by UPI to the owner's UPI ID.
 * The membership starts once an admin finds the payment (Admin → UPI payments).
 */
export async function startMembership(tier: string): Promise<{ checkout?: MembershipCheckout; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to join." };
  if (!upiEnabled()) return { error: "Joining opens soon. Please check back in a day or two." };
  const plan = PLANS.find((p) => p.tier === tier);
  if (!plan) return { error: "Please pick a plan." };
  const current = PLANS.findIndex((p) => p.tier === activeTier(user));
  if (current >= PLANS.indexOf(plan)) return { error: `Your plan already includes ${plan.name}.` };
  const [waiting] = await query<{ tier: string }>("SELECT tier FROM membership_payments WHERE user_id = $1 AND status = 'review'", [user.id]);
  if (waiting) return { error: "We're still checking your last payment. Your membership starts as soon as it's confirmed, usually within a few hours." };
  // Reuse an unfinished payment for the same plan, so going back and forth doesn't pile up rows.
  let [row] = await query<{ id: number }>(
    "UPDATE membership_payments SET amount = $3 WHERE id = (SELECT max(id) FROM membership_payments WHERE user_id = $1 AND tier = $2 AND status = 'pending') RETURNING id",
    [user.id, plan.tier, plan.price],
  );
  if (!row) [row] = await query<{ id: number }>("INSERT INTO membership_payments (user_id, tier, amount) VALUES ($1, $2, $3) RETURNING id", [user.id, plan.tier, plan.price]);
  const note = `CheckInn Club ${plan.name} M${row.id}`;
  // Demo mode: CheckInn Pay's made-up payee, which real UPI apps refuse.
  const link = upiDemo() ? upiPayLink(`M${row.id}`, plan.price, note) : upiLink(plan.price, note);
  const qr = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#061f19", light: "#ffffff" } });
  return { checkout: { id: row.id, plan: plan.name, amount: plan.price, upiId: upiId(), link, qr, demo: upiDemo() } };
}

/** What CheckInn Pay's window sends: card details with the OTP, or how UPI was paid. */
export type CheckInnPayBody =
  | { method: "card"; card: { number: string; expiry: string; cvv: string; otp: string } }
  | { method: "upi"; upi: { qr?: boolean; app?: string; vpa?: string; simulate?: "decline" } };

/**
 * CheckInn Pay's bank: decides a payment from the details entered (lib/checkinnpay has the test cards, UPI IDs and OTP).
 * No money moves; card numbers are checked and dropped, only the last four go into the reference.
 */
function decideCheckInnPay(body: CheckInnPayBody): { ref: string } | { error: string; invalid?: boolean } {
  const stamp = Date.now().toString(36).toUpperCase();
  let ref: string;
  if (body?.method === "card") {
    const card = { number: String(body.card?.number ?? ""), expiry: String(body.card?.expiry ?? ""), cvv: String(body.card?.cvv ?? "") };
    const problem = cardProblem(card);
    if (problem) return { invalid: true, error: problem };
    if (String(body.card?.otp ?? "") !== TEST.otp) return { error: "Incorrect OTP. The payment was not made." };
    if (cardDeclined(card.number)) return { error: "Your bank declined this card. No money was taken." };
    ref = `CPAY-CARD-${(cardBrand(card.number) ?? "CARD").toUpperCase()}-${digits(card.number).slice(-4)}-${stamp}`;
  } else if (body?.method === "upi" && (body.upi?.qr === true || UPI_APPS.some((a) => a.id === body.upi?.app))) {
    // Scanned QR (laptop) or a hand-off to a UPI app (phone): "I've paid" stands for the app confirming.
    if (body.upi.simulate === "decline") return { error: "The payment was not completed in the UPI app. No money was taken." };
    ref = body.upi.qr === true ? `CPAY-UPI-QR-${stamp}` : `CPAY-UPI-APP-${stamp}`;
  } else if (body?.method === "upi") {
    const vpa = String(body.upi?.vpa ?? "").trim().toLowerCase();
    if (!upiValid(vpa)) return { invalid: true, error: "Check the UPI ID." };
    if (upiDeclined(vpa)) return { error: "The payment request was declined in the UPI app." };
    ref = `CPAY-UPI-${stamp}`;
  } else {
    return { invalid: true, error: "Choose card or UPI." };
  }
  return { ref };
}

/**
 * CheckInn Pay, the demo gateway, for Club membership: decides the payment the way a bank would, from the details
 * entered (lib/checkinnpay has the test cards, UPI IDs and OTP). No money moves; card numbers are checked and dropped,
 * only the last four are kept. A paid membership starts straight away. Only used while no real UPI ID is set.
 */
export async function payMembership(id: number, body: CheckInnPayBody): Promise<{ paid: boolean; error?: string; invalid?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { paid: false, error: "Please sign in again." };
  if (!upiDemo()) return { paid: false, error: "CheckInn Pay is off. Please pay by UPI." };
  const decided = decideCheckInnPay(body);
  if ("error" in decided) return { paid: false, ...decided };
  const { ref } = decided;

  const today = nowInIndia().date;
  const paid = await transaction(async (client) => {
    const {
      rows: [p],
    } = await client.query<{ tier: string }>(
      "UPDATE membership_payments SET status = 'verified', ref = $3, reviewed_at = now() WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING tier",
      [id, user.id, ref],
    );
    if (!p) return false;
    // Same rule as an admin verifying a UPI payment: a year from today, or a year added to the same plan's time left.
    await client.query(
      `UPDATE users SET membership_tier = $2::varchar,
         membership_expires = (CASE WHEN membership_tier = $2::varchar AND membership_expires >= $3::date THEN membership_expires ELSE $3::date END + INTERVAL '1 year')::date
       WHERE id = $1`,
      [user.id, p.tier, today],
    );
    return true;
  });
  if (!paid) return { paid: false, error: "This payment was already made or closed. Reload the page." };
  after(() => sendMembershipDecision(id));
  // No revalidatePath here: refreshing now would swap the Join button (and this window) for "Your current plan" before
  // the success screen shows. The window refreshes the page itself once it closes; every page reads the plan fresh.
  return { paid: true };
}

/** The member paid and entered the UTR: the payment waits for an admin to match it with the bank statement. */
export async function submitMembershipUtr(id: number, utr: string): Promise<{ error?: string } | undefined> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const clean = utr.replace(/\s/g, "");
  if (!/^\d{12}$/.test(clean)) return { error: "Enter the 12-digit UTR (UPI reference number) shown in your payment app." };
  const [{ used }] = await query<{ used: number }>("SELECT count(*)::int AS used FROM bookings WHERE utr = $1", [clean]);
  if (used) return { error: "This UTR has already been used. Check the number in your payment app." };
  try {
    const { rowCount } = await db().query(
      "UPDATE membership_payments SET utr = $3, status = 'review' WHERE id = $1 AND user_id = $2 AND status = 'pending'",
      [id, user.id, clean],
    );
    if (!rowCount) return { error: "This payment was already sent. Reload the page to see where it is." };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "This UTR has already been used. Check the number in your payment app." };
    throw e;
  }
  after(() => sendMembershipPaymentReceived(id));
  revalidatePath("/membership");
}

/**
 * A restaurant owner lists their restaurant from /partner. It waits in Admin → Listings and only goes on the website
 * once an admin approves it.
 */
export async function submitListing(_: FormState, fd: FormData): Promise<FormState> {
  const l = {
    name: str(fd, "name"),
    city: str(fd, "city"),
    area: str(fd, "area"),
    address: str(fd, "address"),
    cuisines: str(fd, "cuisines"),
    price_for_two: Number(str(fd, "price_for_two")),
    food_type: str(fd, "food_type"),
    opening_time: str(fd, "opening_time"),
    closing_time: str(fd, "closing_time"),
    description: str(fd, "description"),
    owner_name: str(fd, "owner_name"),
    owner_phone: str(fd, "owner_phone"),
    owner_email: str(fd, "owner_email").toLowerCase(),
  };
  const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if (l.name.length < 2 || l.name.length > 140) return { error: "Please enter the restaurant's name." };
  if (!(CITIES as readonly string[]).includes(l.city)) return { error: "Please choose the city." };
  if (l.area.length < 2 || l.area.length > 100) return { error: "Please enter the area, e.g. SG Highway." };
  if (l.address.length < 8 || l.address.length > 255) return { error: "Please enter the full address." };
  if (l.cuisines.length < 3 || l.cuisines.length > 255) return { error: "Please list the cuisines, e.g. Gujarati, Thali." };
  if (!Number.isInteger(l.price_for_two) || l.price_for_two < 100 || l.price_for_two > 100000) return { error: "Price for two must be a whole number in rupees, from 100." };
  if (l.food_type !== "veg" && l.food_type !== "nonveg") return { error: "Choose pure veg or non-veg." };
  if (!isTime(l.opening_time) || !isTime(l.closing_time) || l.opening_time === l.closing_time) return { error: "Please set opening and closing times." };
  if (l.description.length < 20 || l.description.length > 1500) return { error: "Please describe the restaurant in a few sentences (20 to 1,500 characters)." };
  if (!isName(l.owner_name)) return { error: "Please enter your name." };
  if (!isPhone(l.owner_phone)) return { error: "Please enter a valid phone number." };
  if (!isEmail(l.owner_email)) return { error: "Please enter a valid email address." };

  const ip = await clientIp();
  // Counted before the slow location and photo work, so parallel submissions can't all get through.
  await recordAttempt("listing-ip", ip);
  if ((await recentAttempts("listing-ip", ip, 24 * 60)) > 8) return { error: "Too many listings from this connection today. Please try again tomorrow." };

  const location = await parseLocation(str(fd, "location"));
  if (location === "invalid") return { error: "We couldn't read that location. Paste a Google Maps share link, or use your current location." };
  if (!location) return { error: "Please add the restaurant's location on the map." };
  const image_url = await savePhoto(str(fd, "photo"));
  if (!image_url) return { error: "Please upload a photo of the restaurant (JPG, PNG or WebP)." };

  const [row] = await query<{ id: number }>(
    `INSERT INTO listings (name, city, area, address, latitude, longitude, cuisines, price_for_two, food_type, opening_time, closing_time,
       description, image_url, owner_name, owner_phone, owner_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
    [l.name, l.city, l.area, l.address, location.latitude, location.longitude, l.cuisines, l.price_for_two, l.food_type, l.opening_time, l.closing_time,
     l.description, image_url, l.owner_name, l.owner_phone, l.owner_email],
  );
  after(() => sendListingReceived(row.id));
  return { success: `Thanks, ${l.owner_name.split(" ")[0]}! We'll check ${l.name} and email you at ${l.owner_email} once it's live, usually within 2 working days.` };
}
