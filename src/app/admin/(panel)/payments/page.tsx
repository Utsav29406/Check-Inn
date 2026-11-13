import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { inr } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/time";
import { upiEnabled } from "@/lib/payments";
import { Card, PageHeader, smallBtn } from "@/components/admin/ui";
import { reviewMembershipPayment, reviewPayment } from "../../actions";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS = [
  ["review", "To check"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
] as const;

type ClubRow = { id: number; tier: string; amount: number; utr: string; created_at: string; reviewed_at: string | null; name: string; email: string; phone: string | null };
type TableRow = Pick<Booking, "code" | "guest_name" | "guest_phone" | "booking_date" | "slot_time" | "guests" | "amount" | "utr" | "status"> & { restaurant_name: string };

const when = (ts: string) =>
  new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** UPI payments to match against the bank statement (UTR = "UPI Ref No." in the bank's transaction list). */
export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some(([k]) => k === rawTab) ? rawTab! : "review";
  const [club, tables] = await Promise.all([
    query<ClubRow>(
      `SELECT p.id, p.tier, p.amount, p.utr, p.created_at, p.reviewed_at, u.name, u.email, u.phone
       FROM membership_payments p JOIN users u ON u.id = p.user_id
       WHERE p.status = $1 ORDER BY p.created_at DESC LIMIT 200`,
      [tab],
    ),
    // Table fees are paid at the restaurant now; this only lists UPI table payments made while that was switched on.
    query<TableRow>(
      `SELECT b.code, b.guest_name, b.guest_phone, b.booking_date, b.slot_time, b.guests, b.amount, b.utr, b.status, r.name AS restaurant_name
       FROM bookings b JOIN restaurants r ON r.id = b.restaurant_id
       WHERE b.utr IS NOT NULL AND b.payment_status = $1 ORDER BY b.created_at DESC LIMIT 200`,
      [tab === "verified" ? "paid" : tab],
    ),
  ]);
  const total = club.reduce((n, p) => n + p.amount, 0);

  return (
    <>
      <PageHeader title="UPI payments" subtitle="CheckInn Club payments. Match each UTR with the “UPI Ref No.” in your bank or UPI app, then verify it." />
      {!upiEnabled() && (
        <p className="mb-4 rounded-xl bg-gold-300/40 px-4 py-3 text-sm">
          Club joining is closed until your UPI ID is set: add <code>UPI_ID</code> (and optionally <code>UPI_NAME</code>) in Vercel → Settings → Environment Variables.
        </p>
      )}
      <div className="mb-4 flex max-w-md gap-1 rounded-xl bg-white p-1 ring-1 ring-black/5">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin/payments?tab=${k}`} className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold ${k === tab ? "bg-brand-600 text-white" : "text-muted"}`}>
            {label}
          </Link>
        ))}
      </div>
      <Card title={`Club · ${club.length} ${club.length === 1 ? "payment" : "payments"} · ${inr(total)}`}>
        <ul className="divide-y divide-black/5">
          {club.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm">
              <div className="min-w-0">
                <p className="font-mono text-lg font-bold tracking-wider">{p.utr}</p>
                <p>
                  <b>{inr(p.amount)}</b> · {p.tier.charAt(0).toUpperCase() + p.tier.slice(1)} for a year
                </p>
                <p className="text-xs text-muted">
                  {p.name} · {p.email}
                  {p.phone && ` · ${p.phone}`} · paid {when(p.created_at)}
                  {p.reviewed_at && ` · checked ${when(p.reviewed_at)}`}
                </p>
              </div>
              {tab === "review" && (
                <form action={reviewMembershipPayment} className="flex gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <button name="decision" value="verify" className={`${smallBtn} bg-brand-600 text-white`}>Found it</button>
                  <button name="decision" value="reject" className={`${smallBtn} border border-red-200 text-red-700`}>Not received</button>
                </form>
              )}
            </li>
          ))}
          {!club.length && <li className="px-5 py-10 text-center text-sm text-muted">Nothing here.</li>}
        </ul>
      </Card>

      {tables.length > 0 && (
        <div className="mt-6">
          <Card title="Table fees paid by UPI">
            <ul className="divide-y divide-black/5">
              {tables.map((b) => (
                <li key={b.code} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-mono text-lg font-bold tracking-wider">{b.utr}</p>
                    <p><b>{inr(b.amount)}</b> · {b.guest_name} · {b.guest_phone}</p>
                    <p className="text-xs text-muted">
                      {b.code} · {b.restaurant_name} · {fmtDate(b.booking_date)}, {fmtTime(b.slot_time)} · {b.guests} guests
                      {b.status === "cancelled" && tab !== "rejected" && " · table not held: refund if received"}
                    </p>
                  </div>
                  <form action={reviewPayment} className="flex gap-2">
                    <input type="hidden" name="code" value={b.code} />
                    {tab !== "verified" && <button name="decision" value="verify" className={`${smallBtn} bg-brand-600 text-white`}>Found it</button>}
                    {tab !== "rejected" && <button name="decision" value="reject" className={`${smallBtn} border border-red-200 text-red-700`}>Not received</button>}
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
