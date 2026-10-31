import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { HOLDS_SEAT, buildSlots, getBlockedSlots } from "@/lib/restaurants";
import { addDays, fmtDate, fmtTime, nowInIndia } from "@/lib/time";
import { Card, PageHeader, PaymentBadge } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { field } from "@/components/admin/ActionForm";
import { setDayClosed, toggleSlot } from "../../actions";
import type { Booking, Restaurant } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Per restaurant and day: seats taken in each slot, and close/reopen slots (or the whole day) for booking. */
export default async function AdminSlots({ searchParams }: { searchParams: Promise<{ restaurant?: string; date?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const now = nowInIndia();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : now.date;

  const restaurants = await query<Restaurant>("SELECT * FROM restaurants ORDER BY city = 'Ahmedabad' DESC, city, name");
  const r = restaurants.find((x) => x.id === Number(sp.restaurant)) ?? restaurants[0];
  if (!r) return <PageHeader title="Slots" subtitle="Add a restaurant first." />;

  const [usage, blocked, bookings] = await Promise.all([
    query<{ slot: string; seats: number; n: number }>(
      `SELECT to_char(slot_time, 'HH24:MI') AS slot, SUM(guests)::int AS seats, count(*)::int AS n
       FROM bookings WHERE restaurant_id = $1 AND booking_date = $2 AND ${HOLDS_SEAT} GROUP BY slot_time`,
      [r.id, date],
    ),
    getBlockedSlots(r.id, date),
    query<Booking>(
      "SELECT * FROM bookings WHERE restaurant_id = $1 AND booking_date = $2 AND status = 'confirmed' ORDER BY slot_time",
      [r.id, date],
    ),
  ]);
  const used = new Map(usage.map((u) => [u.slot, u]));
  const slots = buildSlots(r);
  const closedCount = slots.filter((s) => blocked.includes(s)).length;
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const isPast = (s: string) => date < now.date || (date === now.date && toMin(s) <= now.minutes);
  const days = Array.from({ length: 14 }, (_, i) => addDays(now.date, i));
  const link = (d: string) => `/admin/slots?restaurant=${r.id}&date=${d}`;

  return (
    <>
      <PageHeader title="Slots" subtitle={`${r.capacity_per_slot} seats per slot · ${r.name}, ${r.area}`} />

      <form className="mb-4 grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:grid-cols-[1fr_auto_auto]">
        <select name="restaurant" defaultValue={r.id} className={field}>
          {restaurants.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.city}</option>)}
        </select>
        <input name="date" type="date" defaultValue={date} className={field} />
        <button className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">Show</button>
      </form>
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
        {days.map((d, i) => (
          <Link
            key={d}
            href={link(d)}
            className={`flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 text-sm ${d === date ? "border-brand-600 bg-brand-600 text-white" : "border-black/10 bg-white"}`}
          >
            <span className="text-xs opacity-75">{i === 0 ? "Today" : fmtDate(d, { weekday: "short" })}</span>
            <b>{fmtDate(d, { day: "numeric" })}</b>
            <span className="text-xs opacity-75">{fmtDate(d, { month: "short" })}</span>
          </Link>
        ))}
      </div>

      <Card
        title={`${fmtDate(date, { weekday: "long", day: "numeric", month: "long" })} · ${slots.length - closedCount} of ${slots.length} slots open`}
        action={
          <form action={setDayClosed}>
            <input type="hidden" name="restaurantId" value={r.id} />
            <input type="hidden" name="date" value={date} />
            {closedCount === slots.length ? (
              <button name="close" value="0" className="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">Reopen whole day</button>
            ) : (
              <ConfirmButton name="close" value="1" message={`Close all of ${fmtDate(date)} for booking at ${r.name}? Existing bookings stay.`} className="whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                Close whole day
              </ConfirmButton>
            )}
          </form>
        }
      >
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {slots.map((s) => {
            const u = used.get(s);
            const seats = u?.seats ?? 0;
            const closed = blocked.includes(s);
            const full = seats >= r.capacity_per_slot;
            const pct = Math.min(100, Math.round((seats / r.capacity_per_slot) * 100));
            return (
              <form key={s} action={toggleSlot} className={`rounded-xl p-3 ring-1 ${closed ? "bg-sand ring-black/10" : "bg-white ring-black/10"} ${isPast(s) ? "opacity-50" : ""}`}>
                <input type="hidden" name="restaurantId" value={r.id} />
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="slot" value={s} />
                <div className="flex items-center justify-between">
                  <b>{fmtTime(s)}</b>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${closed ? "bg-ink text-white" : full ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {closed ? "Closed" : full ? "Full" : "Open"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {seats}/{r.capacity_per_slot} seats{u ? ` · ${u.n} ${u.n === 1 ? "booking" : "bookings"}` : ""}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
                  <div className={`h-full ${full ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <button name="close" value={closed ? "0" : "1"} className={`mt-3 w-full rounded-lg py-1.5 text-xs font-semibold ${closed ? "bg-brand-600 text-white" : "border border-black/10"}`}>
                  {closed ? "Reopen" : "Close"}
                </button>
              </form>
            );
          })}
        </div>
      </Card>

      <div className="mt-6">
        <Card title={`Bookings on this day (${bookings.length})`}>
          {bookings.length ? (
            <ul className="divide-y divide-black/5">
              {bookings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <b className="w-20">{fmtTime(b.slot_time)}</b>
                  <span className="min-w-0 flex-1">
                    <b>{b.guest_name}</b> · {b.guests} guests · {b.guest_phone}
                    <span className="block font-mono text-xs text-muted">{b.code}</span>
                  </span>
                  <PaymentBadge status={b.payment_status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted">No bookings for this day.</p>
          )}
        </Card>
      </div>
    </>
  );
}
