import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { paymentMode } from "@/lib/payments";
import { query } from "@/lib/db";
import { inr } from "@/lib/constants";
import { addDays, fmtDate, fmtTime, nowInIndia } from "@/lib/time";
import { Card, PageHeader, PaymentBadge, StatCard } from "@/components/admin/ui";
import { ActionForm, field } from "@/components/admin/ActionForm";
import { emailEnabled } from "@/lib/email";
import { sendTestEmail } from "../actions";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = Pick<Booking, "code" | "guest_name" | "guest_phone" | "slot_time" | "guests" | "payment_status" | "amount"> & { restaurant_name: string };

export default async function AdminDashboard() {
  const admin = await requireAdmin();
  const today = nowInIndia().date;
  const [[stats], todays] = await Promise.all([
    query<{
      today_bookings: number;
      today_guests: number;
      week_bookings: number;
      fees_due: number;
      upi_to_check: number;
      new_partners: number;
      users: number;
    }>(
      `SELECT
         (SELECT count(*) FROM bookings WHERE status = 'confirmed' AND booking_date = $1)::int AS today_bookings,
         (SELECT COALESCE(sum(guests), 0) FROM bookings WHERE status = 'confirmed' AND booking_date = $1)::int AS today_guests,
         (SELECT count(*) FROM bookings WHERE status = 'confirmed' AND booking_date BETWEEN $1 AND $2)::int AS week_bookings,
         (SELECT COALESCE(sum(amount), 0) FROM bookings WHERE status = 'confirmed' AND payment_status = 'due' AND booking_date >= $1)::int AS fees_due,
         (SELECT count(*) FROM bookings WHERE payment_status = 'review')::int AS upi_to_check,
         (SELECT count(*) FROM partner_requests WHERE status = 'new')::int AS new_partners,
         (SELECT count(*) FROM users)::int AS users`,
      [today, addDays(today, 6)],
    ),
    query<Row>(
      `SELECT b.code, b.guest_name, b.guest_phone, b.slot_time, b.guests, b.payment_status, b.amount, r.name AS restaurant_name
       FROM bookings b JOIN restaurants r ON r.id = b.restaurant_id
       WHERE b.status = 'confirmed' AND b.booking_date = $1 ORDER BY b.slot_time, r.name`,
      [today],
    ),
  ]);

  return (
    <>
      <PageHeader title={`Hello, ${admin.name.split(" ")[0]}`} subtitle={fmtDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5 [&:has(>:nth-child(6))]:xl:grid-cols-6">
        <StatCard label="Today" value={stats.today_bookings} hint={`${stats.today_guests} guests`} href={`/admin/bookings?date=${today}`} />
        <StatCard label="Next 7 days" value={stats.week_bookings} hint="confirmed bookings" href="/admin/bookings" />
        <StatCard label="Fees due" value={inr(stats.fees_due)} hint="to collect at restaurants" href="/admin/bookings?pay=due" />
        {paymentMode() === "upi" && <StatCard label="UPI to check" value={stats.upi_to_check} href="/admin/payments" />}
        <StatCard label="New partners" value={stats.new_partners} hint="restaurant requests" href="/admin/users#partners" />
        <StatCard label="Users" value={stats.users} href="/admin/users" />
      </div>

      <div className="mt-8">
        <Card title={`Today's bookings (${todays.length})`} action={<Link href="/admin/slots" className="text-sm font-semibold text-brand-600">Manage slots</Link>}>
          {todays.length ? (
            <ul className="divide-y divide-black/5">
              {todays.map((b) => (
                <li key={b.code} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <b className="w-20 shrink-0">{fmtTime(b.slot_time)}</b>
                  <span className="min-w-0 flex-1">
                    <b>{b.guest_name}</b> · {b.guests} guests · {b.restaurant_name}
                    <span className="block text-xs text-muted">{b.guest_phone} · {b.code}</span>
                  </span>
                  <PaymentBadge status={b.payment_status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted">No bookings today yet.</p>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Confirmation emails">
          <div className="p-5">
            <p className="text-sm text-muted">
              {emailEnabled()
                ? `Guests get a confirmation from ${process.env.GMAIL_USER}. Send a sample to any address to check it arrives and looks right.`
                : "Emails are off: set GMAIL_USER and GMAIL_APP_PASSWORD to turn them on."}
            </p>
            <ActionForm action={sendTestEmail} submit="Send test email" className="mt-3 flex flex-wrap items-start gap-3 [&>p]:basis-full">
              <input name="to" type="email" required placeholder="name@outlook.com" className={`${field} max-w-xs`} />
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}
