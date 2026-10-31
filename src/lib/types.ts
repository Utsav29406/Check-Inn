export type Tier = "none" | "silver" | "gold" | "platinum";
export type FoodType = "veg" | "nonveg";

export interface Restaurant {
  id: number;
  slug: string;
  name: string;
  city: string;
  area: string;
  address: string;
  cuisines: string;
  price_for_two: number;
  rating: number;
  reviews_count: number;
  image_url: string;
  description: string;
  highlights: string;
  opening_time: string;
  closing_time: string;
  break_start: string | null;
  break_end: string | null;
  capacity_per_slot: number;
  discount_percent: number;
  is_featured: boolean;
  food_type: FoodType;
  /** Table booking fee in rupees, per guest. */
  booking_fee: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  membership_tier: Tier;
  membership_expires: string | null;
}

export interface Booking {
  id: number;
  code: string;
  restaurant_id: number;
  user_id: number | null;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  booking_date: string;
  slot_time: string;
  guests: number;
  special_request: string | null;
  discount_percent: number;
  status: "pending" | "confirmed" | "cancelled";
  fee_per_guest: number;
  amount: number;
  payment_status: "none" | "due" | "pending" | "review" | "paid" | "rejected";
  utr: string | null;
  /** When the guest was emailed a reminder of this table. */
  reminder_sent_at: string | null;
  /** Coupon taken off the booking fee: amount = fee_per_guest × guests − coupon_discount. */
  coupon_code: string | null;
  coupon_discount: number;
  created_at: string;
  restaurant_name: string;
  restaurant_slug: string;
  restaurant_area: string;
  restaurant_city: string;
  restaurant_image: string;
  restaurant_address: string;
}

/** Takes money off the table booking fee. */
export interface Coupon {
  id: number;
  code: string;
  title: string;
  kind: "flat" | "percent";
  value: number;
  max_discount: number | null;
  min_guests: number;
  valid_until: string | null;
  max_uses: number | null;
  once_per_user: boolean;
  user_id: number | null;
  is_public: boolean;
  active: boolean;
  /** Set for festival offers (e.g. "diwali"): they only work while that festival is on. */
  festival: string | null;
}

/** What a scratched card shows. */
export interface ScratchReveal {
  won: boolean;
  headline: string;
  detail: string;
  code?: string;
  validUntil?: string;
}
