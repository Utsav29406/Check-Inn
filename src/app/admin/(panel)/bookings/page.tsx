import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { inr } from "@/lib/constants";
import { fmtDate, fmtTime, nowInIndia } from "@/lib/time";
import { Card, PageHeader, PaymentBadge, StatusBadge, smallBtn } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { ReminderButton } from "@/components/admin/ReminderButton";
import { field } from "@/components/admin/ActionForm";
import { adminCancelBooking, markFeePaid } from "../../actions";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

type Search = { when?: string; date?: string; restaurant?: string; status?: string; pay?: string; q?: string };
type Row = Booking & { restaurant_name: string };

const WHEN: Record<string, string> = { upcoming: "Upcoming", today: "Today", past: "Past", all: "All dates" };

export default async function AdminBookings({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  // A repeated parameter (?q=a&q=b) arrives as an array: use the first value.
  const sp = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Search;
  const today = nowInIndia().date;
  const when = sp.date ? "date" : WHEN[sp.when ?? ""] ? sp.when! : "upcoming";
  const status = sp.status === "cancelled" || sp.status === "all" ? sp.status : "confirmed";

  const where: string[] = ["b.status <> 'pending'"];
  const params: unknown[] = [];
  const p = (v: unknown) => `$${params.push(v)}`;
  if (when === "date" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date!)) where.push(`b.booking_date = ${p(sp.date)}`);
  if (when === "upcoming") where.push(`b.booking_date >= ${p(today)}`);
  if (when === "today") where.push(`b.booking_date = ${p(today)}`);
  if (when === "past") where.push(`b.booking_date < ${p(today)}`);
  if (status !== "all") where.push(`b.status = ${p(status)}`);
  if (Number(sp.restaurant)) where.push(`b.restaurant_id = ${p(Number(sp.restaurant))}`);
  if (sp.pay) where.push(`b.payment_status = ${p(sp.pay)}`);
  if (sp.q) {
    const q = p(`%${sp.q.trim()}%`);
    where.push(`(b.code ILIKE ${q} OR b.guest_name ILIKE ${q} OR b.guest_phone ILIKE ${q} OR b.guest_email ILIKE ${q})`);
  }
  const order = when === "past" ? "b.booking_date DESC, b.slot_time DESC" : "b.booking_date, b.slot_time";

  const [rows, restaurants] = await Promise.all([
    query<Row>(
      `SELECT b.*, r.name AS restaurant_name FROM bookings b JOIN restaurants r ON r.id = b.restaurant_id
       WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 300`,
      params,
    ),
    query<{ id: number; name: string; city: string }>("SELECT id, name, city FROM restaurants ORDER BY city, name"),
  ]);
  const guests = rows.filter((b) => b.status === "confirmed").reduce((n, b) => n + b.guests, 0);

  return (
    <>
      <PageHeader title="Bookings" subtitle={`${rows.length} bookings · ${guests} guests`} />

      <form className="mb-5 grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Code, name, phone or email" className={field} />
        <select name="when" defaultValue={when === "date" ? "" : when} className={field}>
          {Object.entries(WHEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input name="date" type="date" defaultValue={sp.date} aria-label="Exact date" className={field} />
        <select name="restaurant" defaultValue={sp.restaurant ?? ""} className={field}>
          <option value="">All restaurants</option>
          {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.city}</option>)}
        </select>
        <select name="status" defaultValue={status} className={field}>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">Any status</option>
        </select>
        <div className="flex gap-2">
          <button className="flex-1 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">Filter</button>
          <Link href="/admin/bookings" className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold">Reset</Link>
        </div>
      </form>

      <Card>
        {rows.length ? (
          <ul className="divide-y divide-black/5">
            {rows.map((b) => {
              const upcoming = b.status === "confirmed" && b.booking_date >= today;
              return (
                <li key={b.id} className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[150px_minmax(0,1fr)_auto] md:items-center">
                  <div>
                    <b>{fmtDate(b.booking_date)}</b>
                    <span className="block text-muted">{fmtTime(b.slot_time)} · {b.guests} guests</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate">
                      <b>{b.guest_name}</b> · {b.guest_phone}
                      {b.guest_email && <span className="text-muted"> · {b.guest_email}</span>}
                    </p>
                    <p className="truncate text-muted">
                      <Link href={`/bookings/${b.code}`} target="_blank" className="font-mono font-semibold text-brand-600">{b.code}</Link> · {b.restaurant_name}
                      {b.amount > 0 && ` · fee ${inr(b.amount)}`}
                      {b.coupon_code && ` · coupon ${b.coupon_code} −${inr(b.coupon_discount)}`}
                      {b.utr && ` · UTR ${b.utr}`}
                    </p>
                    {b.special_request && <p className="mt-1 truncate text-xs italic text-muted">“{b.special_request}”</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={b.status} />
                    <PaymentBadge status={b.payment_status} />
                    {upcoming && b.guest_email && <ReminderButton code={b.code} sentAt={b.reminder_sent_at} />}
                    {b.status === "confirmed" && b.payment_status === "due" && (
                      <form action={markFeePaid}>
                        <input type="hidden" name="code" value={b.code} />
                        <button className={`${smallBtn} bg-brand-600 text-white`}>Fee received</button>
                      </form>
                    )}
                    {b.status === "confirmed" && (
                      <form action={adminCancelBooking}>
                        <input type="hidden" name="code" value={b.code} />
                        <ConfirmButton message={`Cancel booking ${b.code} for ${b.guest_name}?`} className={`${smallBtn} border border-red-200 text-red-700`}>
                          Cancel
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-muted">No bookings match these filters.</p>
        )}
      </Card>
    </>
  );
}
