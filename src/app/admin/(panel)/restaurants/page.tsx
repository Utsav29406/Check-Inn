import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { FOOD_TYPES, inr } from "@/lib/constants";
import { Card, PageHeader, smallBtn } from "@/components/admin/ui";
import { FoodMark } from "@/components/FoodMark";
import type { Restaurant } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminRestaurants({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const { saved } = await searchParams;
  const rows = await query<Restaurant & { upcoming: number }>(
    `SELECT r.*, (SELECT count(*) FROM bookings b WHERE b.restaurant_id = r.id AND b.status = 'confirmed' AND b.booking_date >= CURRENT_DATE)::int AS upcoming
     FROM restaurants r ORDER BY r.city = 'Ahmedabad' DESC, r.city, r.name`,
  );

  return (
    <>
      <PageHeader title="Restaurants" subtitle={`${rows.length} restaurants`}>
        <Link href="/admin/restaurants/new" className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> Add restaurant
        </Link>
      </PageHeader>
      {saved && (
        <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved. <Link href={`/restaurants/${saved}`} target="_blank" className="font-semibold underline">View it on the site</Link>
        </p>
      )}
      <Card>
        <ul className="divide-y divide-black/5">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold">
                  <FoodMark type={r.food_type} className="h-3.5 w-3.5" />
                  <span className="truncate">{r.name}</span>
                  {r.is_featured && <span className="rounded-full bg-gold-300/60 px-2 py-0.5 text-[10px] font-bold text-gold-600">Featured</span>}
                </p>
                <p className="truncate text-muted">{r.area}, {r.city} · {r.cuisines}</p>
              </div>
              <p className="text-muted">
                <Star className="mb-0.5 inline h-3.5 w-3.5 fill-gold-500 text-gold-500" /> {r.rating.toFixed(1)} · {inr(r.price_for_two)} for two ·{" "}
                <b className="text-ink">{inr(r.booking_fee)}</b>/guest fee · {r.capacity_per_slot} seats/slot
                {r.discount_percent > 0 && ` · ${r.discount_percent}% off`} · {FOOD_TYPES[r.food_type]} · {r.upcoming} upcoming
              </p>
              <div className="flex gap-2">
                <Link href={`/admin/slots?restaurant=${r.id}`} className={`${smallBtn} border border-black/10`}>Slots</Link>
                <Link href={`/admin/restaurants/${r.id}`} className={`${smallBtn} bg-brand-600 text-white`}>Edit</Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
