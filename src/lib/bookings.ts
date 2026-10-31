import "server-only";
import { query } from "./db";
import type { Booking } from "./types";

const BOOKING_SELECT = `
  SELECT b.*, r.name AS restaurant_name, r.slug AS restaurant_slug, r.area AS restaurant_area,
         r.city AS restaurant_city, r.image_url AS restaurant_image,
         r.address AS restaurant_address
  FROM bookings b JOIN restaurants r ON r.id = b.restaurant_id`;

export const getUserBookings = (userId: number) =>
  query<Booking>(`${BOOKING_SELECT} WHERE b.user_id = $1 AND b.status <> 'pending' ORDER BY b.booking_date DESC, b.slot_time DESC`, [userId]);

export async function getBooking(code: string) {
  const [b] = await query<Booking>(`${BOOKING_SELECT} WHERE b.code = $1`, [code]);
  return b ?? null;
}
