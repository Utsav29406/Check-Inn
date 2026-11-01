import type { Booking, Coupon, FoodType, Tier } from "./types";
import { nowInIndia } from "./time";

export const CITIES = ["Ahmedabad", "Mumbai", "Delhi", "Bengaluru", "Pune", "Surat"] as const;

export const CUISINES = [
  { name: "North Indian", image: "photo-1585937421612-70a008356fbe" },
  { name: "Japanese", image: "photo-1579871494447-9811cf80d66c" },
  { name: "Pizza", image: "photo-1513104890138-7c749659a591" },
  { name: "Italian", image: "photo-1565299624946-b28f40a0ae38" },
  { name: "Gujarati", image: "photo-1546069901-ba9599a7e63c" },
  { name: "Steakhouse", image: "photo-1600891964092-4316c288032e" },
  { name: "Pan Asian", image: "photo-1563245372-f21724e3856d" },
  { name: "Seafood", image: "photo-1559339352-11d035aa65de" },
  { name: "Healthy", image: "photo-1540189549336-e6e99c3679fe" },
];

export const unsplash = (id: string, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export interface Plan {
  tier: Exclude<Tier, "none">;
  name: string;
  price: number;
  /** Extra discount stacked on top of the restaurant's own offer. */
  extraDiscount: number;
  perks: string[];
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    tier: "silver",
    name: "Silver",
    price: 999,
    extraDiscount: 5,
    perks: ["Extra 5% off every booking", "Priority waitlist", "Birthday dessert at partner venues"],
  },
  {
    tier: "gold",
    name: "Gold",
    price: 2499,
    extraDiscount: 10,
    perks: ["Extra 10% off every booking", "Complimentary welcome drink", "Priority prime-time slots", "Members-only tasting events"],
    popular: true,
  },
  {
    tier: "platinum",
    name: "Platinum",
    price: 4999,
    extraDiscount: 15,
    perks: ["Extra 15% off every booking", "Chef's table access", "Dedicated concierge on WhatsApp", "Bring a +1 to every club event"],
  },
];

/** Club discount only stacks on restaurants that run a CheckInn offer. */
export function memberExtraDiscount(tier: Tier | undefined, expires: string | null | undefined, restaurantDiscount: number) {
  if (restaurantDiscount <= 0 || !tier || tier === "none" || !expires || expires < nowInIndia().date) return 0;
  return PLANS.find((p) => p.tier === tier)?.extraDiscount ?? 0;
}

export const FOOD_TYPES: Record<FoodType, string> = { veg: "Pure veg", nonveg: "Non-veg" };

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Rupees a coupon takes off a booking fee of `fee`. */
export function couponDiscount(c: Pick<Coupon, "kind" | "value" | "max_discount">, fee: number) {
  const off = c.kind === "flat" ? c.value : Math.floor((fee * c.value) / 100);
  return Math.max(0, Math.min(off, c.max_discount ?? Infinity, fee));
}

/** "₹50 off the booking fee", "50% off the booking fee (up to ₹150)", "Free table booking (up to ₹500)". */
export function couponBenefit(c: Pick<Coupon, "kind" | "value" | "max_discount">) {
  if (c.kind === "flat") return `${inr(c.value)} off the booking fee`;
  const cap = c.max_discount ? ` (up to ${inr(c.max_discount)})` : "";
  return c.value >= 100 ? `Free table booking${cap}` : `${c.value}% off the booking fee${cap}`;
}

/** How a booking's fee was (or will be) paid, or null for bookings made before fees existed. */
export function feeLabel(b: Pick<Booking, "payment_status" | "amount" | "utr" | "coupon_discount">): string | null {
  if (b.coupon_discount > 0) {
    if (b.amount === 0) return "Free with an offer";
    const base = feeLabel({ ...b, coupon_discount: 0 });
    return base && `${base} (${inr(b.coupon_discount)} offer applied)`;
  }
  if (b.payment_status === "review") return `${inr(b.amount)} paid by UPI · being verified`;
  if (b.payment_status === "paid") return `${inr(b.amount)} paid ${b.utr ? "by UPI" : "online"}`;
  if (b.payment_status === "due") return `${inr(b.amount)} payable at the restaurant`;
  return null;
}

/** Google Maps directions: to the exact map pin when the restaurant has one, otherwise a search for its address. */
export const directionsUrl = (name: string, address: string, latitude?: number | null, longitude?: number | null) =>
  latitude != null && longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}`;

/**
 * Whether a booking can still be cancelled: confirmed, its table time hasn't come yet, and its fee wasn't paid.
 * (Cancelling frees the table and any offer it used, so it must not be possible after the meal.)
 */
export function canCancel(b: Pick<Booking, "status" | "booking_date" | "slot_time" | "payment_status">) {
  if (b.status !== "confirmed" || b.payment_status === "paid") return false;
  const now = nowInIndia();
  const [h, m] = b.slot_time.split(":").map(Number);
  return b.booking_date > now.date || (b.booking_date === now.date && h * 60 + m > now.minutes);
}
