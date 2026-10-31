import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { inr } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/time";
import { paymentMode } from "@/lib/payments";
import { Card, PageHeader, smallBtn } from "@/components/admin/ui";
import { reviewPayment } from "../../actions";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS = [
  ["review", "To check"],
  ["paid", "Verified"],
  ["rejected", "Rejected"],
] as const;

type Row = Pick<Booking, "code" | "guest_name" | "guest_phone" | "booking_date" | "slot_time" | "guests" | "amount" | "utr" | "status"> & { restaurant_name: string };

/** UPI QR payments to match against the bank statement (UTR = "UPI Ref No." in the bank's transaction list). */
export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some(([k]) => k === rawTab) ? rawTab! : "review";
  const rows = await query<Row>(
    `SELECT b.code, b.guest_name, b.guest_phone, b.booking_date, b.slot_time, b.guests, b.amount, b.utr, b.status, r.name AS restaurant_name
     FROM bookings b JOIN restaurants r ON r.id = b.restaurant_id
     WHERE b.utr IS NOT NULL AND b.payment_status = $1 ORDER BY b.created_at DESC LIMIT 200`,
    [tab],
  );
  const total = rows.reduce((n, b) => n + b.amount, 0);

  return (
    <>
      <PageHeader title="UPI payments" subtitle="Match each UTR with the “UPI Ref No.” in your bank statement. Not received cancels the booking." />
      {paymentMode() !== "upi" && (
        <p className="mb-4 rounded-xl bg-gold-300/40 px-4 py-3 text-sm">
          UPI QR payments are off, so booking fees are paid at the restaurant. They turn on once a UPI ID is set (the <code>UPI_ID</code> setting).
        </p>
      )}
      <div className="mb-4 flex max-w-md gap-1 rounded-xl bg-white p-1 ring-1 ring-black/5">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin/payments?tab=${k}`} className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold ${k === tab ? "bg-brand-600 text-white" : "text-muted"}`}>
            {label}
          </Link>
        ))}
      </div>
      <Card title={`${rows.length} ${rows.length === 1 ? "payment" : "payments"} · ${inr(total)}`}>
        <ul className="divide-y divide-black/5">
          {rows.map((b) => (
            <li key={b.code} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm">
              <div className="min-w-0">
                <p className="font-mono text-lg font-bold tracking-wider">{b.utr}</p>
                <p><b>{inr(b.amount)}</b> · {b.guest_name} · {b.guest_phone}</p>
                <p className="text-xs text-muted">
                  {b.code} · {b.restaurant_name} · {fmtDate(b.booking_date)}, {fmtTime(b.slot_time)} · {b.guests} guests
                  {b.status === "cancelled" && tab !== "rejected" && " · table not held (cancelled, or the slot filled up while paying): refund if received"}
                </p>
              </div>
              <form action={reviewPayment} className="flex gap-2">
                <input type="hidden" name="code" value={b.code} />
                {tab !== "paid" && <button name="decision" value="verify" className={`${smallBtn} bg-brand-600 text-white`}>Found it</button>}
                {tab !== "rejected" && <button name="decision" value="reject" className={`${smallBtn} border border-red-200 text-red-700`}>Not received</button>}
              </form>
            </li>
          ))}
          {!rows.length && <li className="px-5 py-10 text-center text-sm text-muted">Nothing here.</li>}
        </ul>
      </Card>
    </>
  );
}
