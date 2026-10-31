"use server";

import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, query } from "@/lib/db";
import { adminCount, createAdminSession, destroyAdminSession, requireAdmin } from "@/lib/admin";
import { buildSlots, getRestaurant } from "@/lib/restaurants";
import { CITIES } from "@/lib/constants";
import { nowInIndia } from "@/lib/time";
import { emailEnabled, sendBookingReminder, sendTestConfirmation } from "@/lib/email";
import type { FormState } from "@/app/actions";
import type { Restaurant } from "@/lib/types";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: string) => /^\d{2}:\d{2}$/.test(s);
/** Admin changes show up on the customer site too. */
const refresh = () => revalidatePath("/", "layout");

// ---------- Sign-in ----------

export async function adminLogin(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const [admin] = await query<{ id: number; password_hash: string }>("SELECT id, password_hash FROM admins WHERE email = $1", [email]);
  if (!admin || !(await bcrypt.compare(str(fd, "password"), admin.password_hash))) {
    return { error: "Incorrect email or password." };
  }
  await createAdminSession(admin.id);
  redirect("/admin");
}

export async function adminLogout() {
  await destroyAdminSession();
  redirect("/admin/login");
}

function codeMatches(given: string) {
  const expected = process.env.ADMIN_SETUP_CODE ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return expected.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

/** Creates the very first admin. Only works while there are no admins, and needs ADMIN_SETUP_CODE. */
export async function setupFirstAdmin(_: FormState, fd: FormData): Promise<FormState> {
  if ((await adminCount()) > 0) return { error: "An admin already exists. Sign in instead." };
  if (!codeMatches(str(fd, "code"))) return { error: "That setup code isn't right." };
  const created = await insertAdmin(fd);
  if ("error" in created) return created;
  await createAdminSession(created.id);
  redirect("/admin");
}

async function insertAdmin(fd: FormData): Promise<{ id: number } | { error: string }> {
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (name.length < 2) return { error: "Please enter a name." };
  if (!isEmail(email)) return { error: "Please enter a valid email address." };
  if (password.length < 10) return { error: "Use a password of at least 10 characters." };
  const [row] = await query<{ id: number }>(
    "INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id",
    [name, email, await bcrypt.hash(password, 10)],
  );
  return row ?? { error: "An admin with this email already exists." };
}

export async function addAdmin(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const created = await insertAdmin(fd);
  if ("error" in created) return created;
  revalidatePath("/admin/users");
  return { success: `${str(fd, "name")} can now sign in at /admin/login.` };
}

/** Change an admin's name or email, and optionally set a new password. */
export async function updateAdmin(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (name.length < 2) return { error: "Please enter a name." };
  if (!isEmail(email)) return { error: "Please enter a valid email address." };
  if (password && password.length < 10) return { error: "Use a password of at least 10 characters, or leave it empty to keep the current one." };
  try {
    const { rowCount } = password
      ? await db().query("UPDATE admins SET name = $2, email = $3, password_hash = $4 WHERE id = $1", [id, name, email, await bcrypt.hash(password, 10)])
      : await db().query("UPDATE admins SET name = $2, email = $3 WHERE id = $1", [id, name, email]);
    if (!rowCount) return { error: "This admin no longer exists." };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "Another admin already uses this email." };
    throw e;
  }
  revalidatePath("/admin", "layout");
  return { success: password ? "Saved, including the new password." : "Saved." };
}

export async function removeAdmin(fd: FormData) {
  const me = await requireAdmin();
  const id = Number(fd.get("id"));
  // Never lock everyone out: you can't remove yourself, so at least one admin always remains.
  if (id !== me.id) await query("DELETE FROM admins WHERE id = $1", [id]);
  revalidatePath("/admin/users");
}

// ---------- Bookings & payments ----------

export async function adminCancelBooking(fd: FormData) {
  await requireAdmin();
  await query("UPDATE bookings SET status = 'cancelled' WHERE code = $1 AND status IN ('confirmed', 'pending')", [str(fd, "code")]);
  refresh();
}

/** Emails the guest a reminder of their table now (again, if one already went out). */
export async function emailReminder(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const result = await sendBookingReminder(str(fd, "code"), { force: true });
  if (!result.sent) return { error: result.reason };
  revalidatePath("/admin/bookings");
  return { success: "Reminder sent" };
}

/** The guest paid the booking fee at the restaurant. */
export async function markFeePaid(fd: FormData) {
  await requireAdmin();
  await query("UPDATE bookings SET payment_status = 'paid' WHERE code = $1 AND payment_status = 'due'", [str(fd, "code")]);
  refresh();
}

/** Mark a UPI payment as found in the bank statement, or reject it (which cancels the booking). */
export async function reviewPayment(fd: FormData) {
  await requireAdmin();
  const code = str(fd, "code");
  if (str(fd, "decision") === "verify") {
    // Verifying a payment rejected by mistake also gives the guest their table back.
    await query(
      `UPDATE bookings SET payment_status = 'paid',
         status = CASE WHEN payment_status = 'rejected' THEN 'confirmed' ELSE status END
       WHERE code = $1 AND payment_status IN ('review', 'rejected')`,
      [code],
    );
  } else {
    await query(
      "UPDATE bookings SET payment_status = 'rejected', status = 'cancelled' WHERE code = $1 AND payment_status IN ('review', 'paid') AND utr IS NOT NULL",
      [code],
    );
  }
  refresh();
}

// ---------- Slots ----------

async function slotsFor(restaurantId: number) {
  const [r] = await query<Restaurant>("SELECT * FROM restaurants WHERE id = $1", [restaurantId]);
  return r ? buildSlots(r) : [];
}

/** Close or reopen one time slot for booking. */
export async function toggleSlot(fd: FormData) {
  await requireAdmin();
  const restaurantId = Number(fd.get("restaurantId"));
  const date = str(fd, "date");
  const slot = str(fd, "slot");
  if (!isDate(date) || !(await slotsFor(restaurantId)).includes(slot)) return;
  if (str(fd, "close") === "1") {
    await query("INSERT INTO slot_blocks (restaurant_id, block_date, slot_time) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [restaurantId, date, slot]);
  } else {
    await query("DELETE FROM slot_blocks WHERE restaurant_id = $1 AND block_date = $2 AND slot_time = $3", [restaurantId, date, slot]);
  }
  refresh();
}

/** Close or reopen every slot of a day. */
export async function setDayClosed(fd: FormData) {
  await requireAdmin();
  const restaurantId = Number(fd.get("restaurantId"));
  const date = str(fd, "date");
  if (!isDate(date)) return;
  if (str(fd, "close") === "1") {
    const slots = await slotsFor(restaurantId);
    await query(
      `INSERT INTO slot_blocks (restaurant_id, block_date, slot_time)
       SELECT $1, $2, s::time FROM unnest($3::text[]) AS s ON CONFLICT DO NOTHING`,
      [restaurantId, date, slots],
    );
  } else {
    await query("DELETE FROM slot_blocks WHERE restaurant_id = $1 AND block_date = $2", [restaurantId, date]);
  }
  refresh();
}

// ---------- Restaurants ----------

const slugify = (s: string) =>
  s.toLowerCase().replace(/['’]/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Add (no id) or update a restaurant. */
export async function saveRestaurant(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(fd.get("id")) || null;
  const num = (k: string) => Number(str(fd, k));
  const r = {
    name: str(fd, "name"),
    city: str(fd, "city"),
    area: str(fd, "area"),
    address: str(fd, "address"),
    cuisines: str(fd, "cuisines"),
    price_for_two: num("price_for_two"),
    rating: num("rating"),
    reviews_count: num("reviews_count"),
    image_url: str(fd, "image_url"),
    description: str(fd, "description"),
    highlights: str(fd, "highlights"),
    opening_time: str(fd, "opening_time"),
    closing_time: str(fd, "closing_time"),
    break_start: str(fd, "break_start") || null,
    break_end: str(fd, "break_end") || null,
    capacity_per_slot: num("capacity_per_slot"),
    discount_percent: num("discount_percent"),
    is_featured: fd.get("is_featured") === "on",
    food_type: str(fd, "food_type"),
    booking_fee: num("booking_fee"),
  };

  if (r.name.length < 2 || !r.area || !r.address || !r.cuisines || r.description.length < 10) return { error: "Please fill in the name, area, address, cuisines and description." };
  if (!(CITIES as readonly string[]).includes(r.city)) return { error: "Please choose a city." };
  if (!/^https:\/\/\S+$/.test(r.image_url)) return { error: "The photo must be an https:// image link." };
  if (r.food_type !== "veg" && r.food_type !== "nonveg") return { error: "Choose pure veg or non-veg." };
  if (!isTime(r.opening_time) || !isTime(r.closing_time)) return { error: "Please set opening and closing times." };
  if (Boolean(r.break_start) !== Boolean(r.break_end) || (r.break_start && !(isTime(r.break_start) && isTime(r.break_end!)))) {
    return { error: "Set both break times, or leave both empty." };
  }
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const open = mins(r.opening_time);
  let close = mins(r.closing_time);
  if (close <= open) close += 24 * 60; // closes after midnight
  if (close - open < 60) return { error: "Open for at least an hour (the last booking is an hour before closing)." };
  if (r.break_start && r.break_end) {
    const [bs, be] = [mins(r.break_start), mins(r.break_end)];
    if (bs >= be || bs <= open || be >= close) return { error: "The break must start after opening and end before closing." };
  }
  const ints: [number, number, number, string][] = [
    [r.price_for_two, 100, 100000, "Price for two"],
    [r.booking_fee, 0, 5000, "Booking fee"],
    [r.capacity_per_slot, 1, 500, "Seats per slot"],
    [r.discount_percent, 0, 90, "Offer"],
    [r.reviews_count, 0, 10000000, "Reviews"],
  ];
  for (const [v, min, max, label] of ints) {
    if (!Number.isInteger(v) || v < min || v > max) return { error: `${label} must be a whole number from ${min} to ${max}.` };
  }
  if (!(r.rating >= 1 && r.rating <= 5)) return { error: "Rating must be between 1 and 5." };

  const cols = Object.keys(r) as (keyof typeof r)[];
  const values = cols.map((c) => r[c]);
  let slug: string;
  if (id) {
    const [row] = await query<{ slug: string }>(
      `UPDATE restaurants SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")} WHERE id = $1 RETURNING slug`,
      [id, ...values],
    );
    if (!row) return { error: "This restaurant no longer exists." };
    slug = row.slug;
  } else {
    const base = `${slugify(r.name)}-${slugify(r.city)}`;
    slug = base;
    for (let n = 2; await getRestaurant(slug); n++) slug = `${base}-${n}`;
    await query(
      `INSERT INTO restaurants (slug, ${cols.join(", ")}) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")})`,
      [slug, ...values],
    );
  }
  refresh();
  redirect(`/admin/restaurants?saved=${encodeURIComponent(slug)}`);
}

// ---------- Emails ----------

/** Sends a sample booking confirmation to any address, to check it arrives (and how it looks) in that inbox. */
export async function sendTestEmail(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const to = str(fd, "to");
  if (!isEmail(to)) return { error: "Please enter a valid email address." };
  if (!emailEnabled()) return { error: "Emails are off: set GMAIL_USER and GMAIL_APP_PASSWORD." };
  const [r] = await query<{ name: string; area: string; city: string; address: string }>("SELECT name, area, city, address FROM restaurants ORDER BY is_featured DESC, rating DESC LIMIT 1");
  try {
    await sendTestConfirmation(to, { restaurant_name: r.name, restaurant_area: r.area, restaurant_city: r.city, restaurant_address: r.address });
  } catch (e) {
    return { error: `Gmail couldn't send it: ${(e as Error).message}` };
  }
  return { success: `Sent to ${to}. Check the inbox (and the spam folder) in a minute.` };
}

// ---------- Offers ----------

/** Creates a coupon code. Public ones are listed on /offers; hidden ones work for anyone who has the code. */
export async function addCoupon(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const code = str(fd, "code").toUpperCase();
  const title = str(fd, "title");
  const kind = str(fd, "kind");
  const value = Number(str(fd, "value"));
  const optionalInt = (key: string) => (str(fd, key) ? Number(str(fd, key)) : null);
  const maxDiscount = optionalInt("max_discount");
  const maxUses = optionalInt("max_uses");
  const minGuests = Number(str(fd, "min_guests") || 1);
  const validUntil = str(fd, "valid_until");
  const positive = (n: number | null) => n === null || (Number.isInteger(n) && n > 0);

  if (!/^[A-Z0-9]{3,20}$/.test(code)) return { error: "Use 3 to 20 letters and numbers for the code, e.g. DIWALI100." };
  if (title.length < 3 || title.length > 80) return { error: "Give the offer a short title (up to 80 characters)." };
  if (kind !== "flat" && kind !== "percent") return { error: "Choose ₹ off or % off." };
  if (!Number.isInteger(value) || value < 1 || (kind === "percent" && value > 100)) {
    return { error: kind === "percent" ? "Enter a percentage from 1 to 100." : "Enter the rupees off as a whole number." };
  }
  if (!positive(maxDiscount) || !positive(maxUses)) return { error: "Limits must be whole numbers above 0, or left empty." };
  if (!Number.isInteger(minGuests) || minGuests < 1 || minGuests > 20) return { error: "Minimum guests must be from 1 to 20." };
  if (validUntil && (!isDate(validUntil) || validUntil < nowInIndia().date)) return { error: "The last day must be today or later." };
  try {
    await query(
      `INSERT INTO coupons (code, title, kind, value, max_discount, min_guests, valid_until, max_uses, once_per_user, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [code, title, kind, value, kind === "percent" ? maxDiscount : null, minGuests, validUntil || null, maxUses, fd.get("once_per_user") === "on", fd.get("is_public") === "on"],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: `${code} already exists. Pick another code.` };
    throw e;
  }
  refresh();
  return { success: `${code} is live.` };
}

/** The Diwali theme and its offers: "on" shows them to everyone (until the festival ends), "off" hides them. */
export async function setFestival(fd: FormData) {
  await requireAdmin();
  const value = str(fd, "mode") === "on" ? "on" : "off";
  await query(
    "INSERT INTO site_settings (key, value) VALUES ('festival', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [value],
  );
  refresh();
}

export async function setCouponActive(fd: FormData) {
  await requireAdmin();
  await query("UPDATE coupons SET active = $2 WHERE id = $1 AND user_id IS NULL", [Number(fd.get("id")), str(fd, "active") === "true"]);
  refresh();
}

// ---------- Partner requests ----------

export async function setPartnerStatus(fd: FormData) {
  await requireAdmin();
  const status = str(fd, "status");
  if (!["new", "contacted", "done"].includes(status)) return;
  await query("UPDATE partner_requests SET status = $1 WHERE id = $2", [status, Number(fd.get("id"))]);
  revalidatePath("/admin/users");
}
