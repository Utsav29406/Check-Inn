import Link from "next/link";
import { BadgePercent, CalendarCheck, Gift, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getFestival } from "@/lib/festival";
import { getPublicOffers, getScratchCards, SCRATCH_VALID_DAYS } from "@/lib/offers";
import { fmtDate } from "@/lib/time";
import { ScratchCard } from "@/components/ScratchCard";
import { OfferTicket } from "@/components/OfferTicket";
import { Diya, Mandala, Sparkle } from "@/components/diwali/Art";
import { countdown } from "@/components/diwali/Chrome";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offers & scratch cards | CheckInn" };

const STEPS = [
  { icon: CalendarCheck, title: "Book a table", text: "Pick a restaurant, a time and your party size." },
  { icon: BadgePercent, title: "Save automatically", text: "No codes to type: the best offer you qualify for comes off the booking fee." },
  { icon: Gift, title: "Scratch and win", text: `Every table you book while signed in earns a scratch card. Wins last ${SCRATCH_VALID_DAYS} days.` },
];

export default async function OffersPage() {
  const [user, festival] = await Promise.all([getCurrentUser(), getFestival()]);
  const [offers, cards] = await Promise.all([getPublicOffers(festival?.key ?? null), user ? getScratchCards(user.id) : []]);
  const specials = offers.filter((o) => o.festival);
  const everyday = offers.filter((o) => !o.festival);
  const fresh = cards.filter((c) => !c.reveal).length;

  return (
    <>
      {festival && (
        <section className="relative isolate overflow-hidden bg-[radial-gradient(120%_140%_at_50%_0%,#1d6650_0%,#061f19_65%)] px-4 pt-12 pb-16 text-center text-white">
          <Mandala className="animate-spin-slow absolute -top-28 -left-28 -z-10 h-72 w-72 text-gold-400 opacity-30 md:h-104 md:w-104" />
          <Mandala className="animate-spin-slow absolute -right-28 -bottom-32 -z-10 h-72 w-72 text-gold-400 opacity-30 md:h-104 md:w-104" />
          <Sparkle className="absolute top-10 right-[16%] -z-10 h-4 w-4" />
          <Sparkle className="absolute top-24 left-[14%] -z-10 h-3 w-3" delay={1.2} />
          <Sparkle className="absolute right-[26%] bottom-14 -z-10 hidden h-5 w-5 md:block" delay={2.1} />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300 md:tracking-[0.25em]">
            {countdown(festival)} · {fmtDate(festival.day, { day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">
            Diwali <span className="text-gradient-gold italic">specials</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-white/75">
            Light up the festival at the city&rsquo;s finest tables. Shagun from us on every booking until{" "}
            {fmtDate(festival.ends, { day: "numeric", month: "long" })}.
          </p>
          <div className="mt-8 flex items-end justify-center gap-3 sm:gap-6">
            {[0.2, 0, 0.5].map((d, i) => (
              <Diya key={i} delay={d} className={i === 1 ? "h-16 w-16" : "h-12 w-12"} />
            ))}
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 md:pt-12">
        {!festival && (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">Offers &amp; rewards</p>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Save on every table</h1>
            <p className="mt-2 max-w-xl text-muted">The best offer comes off automatically when you book, and every booking earns a scratch card.</p>
          </>
        )}

        {specials.length > 0 && (
          <section className={festival ? "md:-mt-4" : "mt-8"}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {specials.map((o) => (
                <OfferTicket key={o.id} offer={o} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
              {festival ? <Diya className="h-7 w-7" /> : <Sparkles className="h-5 w-5 text-gold-500" />}
              {festival ? "Your Diwali scratch cards" : "Your scratch cards"}
            </h2>
            {fresh > 0 && <span className="rounded-full bg-gold-300/60 px-3 py-1 text-xs font-bold text-gold-600">{fresh} to scratch</span>}
          </div>
          {festival && <p className="mt-1 text-sm text-muted">Through Diwali, cards hide shagun of ₹51, ₹101 or ₹251, or a free table booking.</p>}
          {!user ? (
            <div className="mt-4 flex flex-col items-start gap-4 rounded-2xl bg-[radial-gradient(120%_120%_at_100%_0%,#1d6650_0%,#061f19_60%)] p-6 text-white sm:flex-row sm:items-center">
              <Gift className="h-10 w-10 shrink-0 text-gold-400" />
              <div className="flex-1">
                <p className="font-display text-xl font-bold">Every booking earns a scratch card</p>
                <p className="mt-0.5 text-sm text-white/70">Sign in before you book to collect them. Win up to a free table booking.</p>
              </div>
              <Link href="/login?next=/offers" className="rounded-xl bg-gold-400 px-5 py-2.5 font-semibold text-brand-900 hover:bg-gold-300">
                Sign in
              </Link>
            </div>
          ) : cards.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center">
              <Gift className="mx-auto h-10 w-10 text-gold-500" />
              <p className="mt-3 font-semibold">No scratch cards yet</p>
              <p className="mt-1 text-sm text-muted">Book a table and you&rsquo;ll get one straight away.</p>
              <Link href="/restaurants" className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">
                Find a table
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <div key={c.id}>
                  <ScratchCard id={c.id} initial={c.reveal} used={c.used} festive={Boolean(festival)} />
                  <p className="mt-2 text-center text-xs text-muted">
                    From your table at{" "}
                    <Link href={`/bookings/${c.bookingCode}`} className="font-semibold text-ink hover:text-brand-600">
                      {c.restaurantName}
                    </Link>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">{festival ? "More offers" : "Offers for everyone"}</h2>
          {everyday.length === 0 ? (
            <p className="mt-3 text-muted">No open offers right now. Check back soon.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {everyday.map((o) => (
                <OfferTicket key={o.id} offer={o} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12 grid gap-4 rounded-3xl bg-white p-6 ring-1 ring-black/5 sm:grid-cols-3 sm:p-8">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">
                  {i + 1}. {title}
                </p>
                <p className="mt-0.5 text-sm text-muted">{text}</p>
              </div>
            </div>
          ))}
        </section>
        <p className="mt-4 text-center text-xs text-muted">Offers take money off the table booking fee. One offer per booking, always the best one you qualify for.</p>
      </div>
    </>
  );
}
