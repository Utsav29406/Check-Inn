import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Users, BadgePercent, CircleCheck, CircleX, Ticket } from "lucide-react";
import { getBooking } from "@/lib/bookings";
import { getCurrentUser, validBookingToken } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/time";
import { cancelBooking } from "@/app/actions";
import { canCancel, feeLabel } from "@/lib/constants";
import { getBookingScratchCard } from "@/lib/offers";
import { getFestival } from "@/lib/festival";
import { ScratchCard } from "@/components/ScratchCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking | CheckInn" };

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  /** t: signed token from the confirmation email, which allows cancelling without signing in. */
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ code }, { t }] = await Promise.all([params, searchParams]);
  const viaEmail = validBookingToken(code, t);
  const [b, user] = await Promise.all([getBooking(code), getCurrentUser()]);
  if (!b) notFound();
  // An unpaid booking never reserved a table; show it like a cancelled one.
  const unpaid = b.status === "pending" || (b.status === "cancelled" && b.payment_status === "pending");
  const rejected = b.payment_status === "rejected";
  const cancelled = b.status !== "confirmed";
  const fee = feeLabel(b);
  const cancellable = canCancel(b) && (viaEmail || (user && b.user_id === user.id));
  const [card, festival] = await Promise.all([
    user && b.user_id === user.id && !cancelled ? getBookingScratchCard(b.code, user.id) : null,
    getFestival(),
  ]);

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/5">
        <div className={`px-8 py-10 text-center text-white ${cancelled ? "bg-ink/80" : "bg-brand-600"}`}>
          {cancelled ? <CircleX className="mx-auto h-14 w-14 text-white/70" /> : <CircleCheck className="mx-auto h-14 w-14 text-gold-300" />}
          <h1 className="mt-4 font-display text-3xl font-bold">
            {unpaid ? "Payment not completed" : rejected ? "Payment not found" : cancelled ? "Booking cancelled" : "Table confirmed!"}
          </h1>
          <p className="mt-2 text-white/75">
            {unpaid
              ? "This table isn't reserved. Book again to try the payment once more."
              : rejected
                ? `We couldn't find a UPI payment with UTR ${b.utr}, so the table was released. If you did pay, contact us with this booking code.`
                : cancelled
                ? "This reservation is no longer active."
                : `See you at ${b.restaurant_name}, ${b.guest_name.split(" ")[0]}.`}
          </p>
        </div>

        <div className="relative border-b-2 border-dashed border-black/10 px-8 py-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Booking code</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-brand-600">{b.code}</p>
          <span className="absolute -bottom-3 -left-3 h-6 w-6 rounded-full bg-cream" />
          <span className="absolute -bottom-3 -right-3 h-6 w-6 rounded-full bg-cream" />
        </div>

        <dl className="space-y-4 px-8 py-6">
          <Row icon={MapPin} label="Restaurant">
            <Link href={`/restaurants/${b.restaurant_slug}`} className="font-semibold hover:text-brand-600">{b.restaurant_name}</Link>
            <span className="block text-sm text-muted">{b.restaurant_area}, {b.restaurant_city}</span>
          </Row>
          <Row icon={CalendarDays} label="Date">{fmtDate(b.booking_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</Row>
          <Row icon={Clock} label="Time">{fmtTime(b.slot_time)}</Row>
          <Row icon={Users} label="Guests">{b.guests}</Row>
          {fee && !unpaid && (
            <Row icon={Ticket} label="Booking fee">
              {fee}
              {b.utr && <span className="block font-mono text-sm text-muted">UTR {b.utr}</span>}
            </Row>
          )}
          {b.discount_percent > 0 && <Row icon={BadgePercent} label="Offer">Flat {b.discount_percent}% off the total bill</Row>}
          {b.special_request && <p className="rounded-xl bg-sand px-4 py-3 text-sm">“{b.special_request}”</p>}
        </dl>

        <div className="flex flex-col gap-3 px-8 pb-8 sm:flex-row">
          <Link href="/bookings" className="flex-1 rounded-xl border border-black/10 py-3 text-center font-semibold hover:bg-sand">
            My bookings
          </Link>
          {cancellable && (
            <form action={cancelBooking} className="flex-1">
              <input type="hidden" name="code" value={b.code} />
              {viaEmail && <input type="hidden" name="t" value={t} />}
              <button className="w-full rounded-xl bg-ink py-3 font-semibold text-white hover:bg-brand-900">Cancel booking</button>
            </form>
          )}
        </div>
      </div>

      {card && (
        <section className="mt-6 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">{festival ? "Diwali shagun from CheckInn" : "A thank-you from CheckInn"}</p>
          <h2 className="mt-1 font-display text-2xl font-bold">{card.reveal ? "Your scratch card" : "You've earned a scratch card!"}</h2>
          <div className="mx-auto mt-5 max-w-sm">
            <ScratchCard id={card.id} initial={card.reveal} used={card.used} festive={Boolean(festival)} />
          </div>
          <Link href="/offers" className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline">
            All your cards and offers
          </Link>
        </section>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}
