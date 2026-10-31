import Link from "next/link";
import { couponBenefit, inr } from "@/lib/constants";
import { fmtDate } from "@/lib/time";
import type { Coupon } from "@/lib/types";
import { Mandala } from "./diwali/Art";

/** "₹50" / "25%" / "FREE", for the ticket stub. */
const stub = (c: Coupon) => (c.kind === "flat" ? inr(c.value) : c.value >= 100 ? "FREE" : `${c.value}%`);

/** A coupon as a tear-off ticket: the benefit on the stub, the details beside it. No code: it's applied, and shown, in the booking form. */
export function OfferTicket({ offer: o }: { offer: Coupon }) {
  const festive = Boolean(o.festival);
  return (
    <article className={`flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ${festive ? "ring-gold-400/60" : "ring-black/5"}`}>
      <div
        className={`relative flex w-28 shrink-0 flex-col items-center justify-center overflow-hidden px-2 text-center text-white sm:w-32 ${
          festive ? "bg-[radial-gradient(120%_120%_at_100%_0%,#1d6650_0%,#061f19_60%)]" : "bg-brand-600"
        }`}
      >
        {festive && <Mandala className="absolute -bottom-12 -left-12 h-32 w-32 text-gold-400 opacity-40" />}
        <span className="relative font-display text-3xl font-bold text-gold-300 [font-variant-numeric:lining-nums]">{stub(o)}</span>
        <span className="relative text-[11px] font-semibold uppercase tracking-widest text-white/70">{o.kind === "percent" && o.value >= 100 ? "booking" : "off"}</span>
        <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-cream" />
        <span className="absolute -bottom-2.5 -right-2.5 h-5 w-5 rounded-full bg-cream" />
      </div>
      <div className="min-w-0 flex-1 border-l-2 border-dashed border-black/10 p-5">
        {festive && <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gold-600">Diwali special</p>}
        <h3 className="font-display text-lg leading-snug font-bold [font-variant-numeric:lining-nums]">{o.title}</h3>
        <p className="mt-0.5 text-sm text-muted">{couponBenefit(o)}</p>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {o.min_guests > 1 && <li>{o.min_guests}+ guests</li>}
          {o.once_per_user && <li>Once per guest</li>}
          {o.max_uses && <li>First {o.max_uses} bookings</li>}
          {o.valid_until && <li>Until {fmtDate(o.valid_until, { day: "numeric", month: "short" })}</li>}
        </ul>
        <Link href="/restaurants" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline">
          Book a table →
        </Link>
      </div>
    </article>
  );
}
