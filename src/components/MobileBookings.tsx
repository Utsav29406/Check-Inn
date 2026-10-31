import Link from "next/link";
import { CalendarX, Check, ChevronRight, Navigation, Share2 } from "lucide-react";
import { canCancel, directionsUrl, feeLabel } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/time";
import type { Booking } from "@/lib/types";
import { CancelButton } from "./CancelButton";
import { SafeImage } from "./SafeImage";
import { ShareButton } from "./ShareButton";

/** Phone-only My bookings: next booking as a ticket, Upcoming / Past tabs. */
export function MobileBookings({ upcoming, past, tab }: { upcoming: Booking[]; past: Booking[]; tab: "upcoming" | "past" }) {
  const [next, ...later] = upcoming;
  const list = tab === "past" ? past : later;
  return (
    <div className="px-4 pt-5 pb-6 md:hidden">
      <h1 className="font-display text-[1.75rem] font-bold">My bookings</h1>
      <div role="tablist" className="mt-4 flex gap-1 rounded-xl bg-sand p-1">
        {(["upcoming", "past"] as const).map((t) => (
          <Link
            key={t}
            href={t === "past" ? "/bookings?tab=past" : "/bookings"}
            role="tab"
            aria-selected={tab === t}
            replace
            scroll={false}
            className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold ${tab === t ? "bg-white text-ink shadow-sm" : "text-muted"}`}
          >
            {t === "past" ? `Past (${past.length})` : `Upcoming (${upcoming.length})`}
          </Link>
        ))}
      </div>

      {tab === "upcoming" && next && <Ticket b={next} />}
      {tab === "upcoming" && later.length > 0 && <p className="mt-6 text-[11px] font-semibold uppercase tracking-widest text-muted">Also coming up</p>}

      <div className="mt-3 grid gap-2.5">
        {list.map((b) => (
          <Link key={b.id} href={`/bookings/${b.code}`} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-black/5">
            <SafeImage src={b.restaurant_image} alt="" className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{b.restaurant_name}</p>
              <p className="truncate text-xs text-muted">
                {fmtDate(b.booking_date)} · {fmtTime(b.slot_time)} · {b.guests} {b.guests === 1 ? "guest" : "guests"}
              </p>
            </div>
            {b.status === "cancelled" ? (
              <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-bold text-muted">Cancelled</span>
            ) : tab === "past" ? (
              <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-bold text-muted">Visited</span>
            ) : (
              <ChevronRight className="h-4 w-4 text-muted" />
            )}
          </Link>
        ))}
      </div>

      {((tab === "upcoming" && !next) || (tab === "past" && !past.length)) && (
        <div className="mt-14 flex flex-col items-center text-center">
          <CalendarX className="h-11 w-11 text-muted" />
          <h2 className="mt-3 font-display text-xl font-bold">{tab === "past" ? "No past bookings" : "No upcoming bookings"}</h2>
          <p className="mt-1 text-sm text-muted">Your next great meal is a few taps away.</p>
          <Link href="/restaurants" className="mt-5 rounded-full bg-brand-600 px-6 py-2.5 font-semibold text-white">
            Find a table
          </Link>
        </div>
      )}
    </div>
  );
}

function Ticket({ b }: { b: Booking }) {
  return (
    <div className="mt-4 overflow-hidden rounded-[1.25rem] bg-white shadow-[0_16px_30px_-24px_rgba(6,31,25,.6)] ring-1 ring-black/5">
      <Link href={`/bookings/${b.code}`} className="flex items-center gap-3 bg-brand-600 p-4 text-white">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-400 text-brand-900">
          <Check className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-lg font-bold">Table confirmed</span>
          <span className="block truncate text-xs text-white/75">
            {b.restaurant_name} · {b.restaurant_area}
          </span>
        </span>
      </Link>
      <div className="relative border-b-2 border-dashed border-black/10 py-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">Booking code</p>
        <p className="font-mono text-2xl font-bold tracking-[0.25em] text-brand-600">{b.code}</p>
        <span className="absolute -bottom-3 -left-3 h-6 w-6 rounded-full bg-cream" />
        <span className="absolute -bottom-3 -right-3 h-6 w-6 rounded-full bg-cream" />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-4 py-3.5">
        {[
          ["Date", fmtDate(b.booking_date)],
          ["Time", fmtTime(b.slot_time)],
          ["Guests", String(b.guests)],
          ["Offer", b.discount_percent > 0 ? `Flat ${b.discount_percent}% off` : "None"],
          ...(feeLabel(b) ? [["Booking fee", feeLabel(b)!]] : []),
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">{k}</dt>
            <dd className="text-sm font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className={`grid ${canCancel(b) ? "grid-cols-3" : "grid-cols-2"} divide-x divide-black/5 border-t border-black/5 text-xs font-semibold text-brand-600`}>
        <a href={directionsUrl(b.restaurant_name, b.restaurant_address)} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 py-3">
          <Navigation className="h-5 w-5" /> Directions
        </a>
        <ShareButton title={`Table at ${b.restaurant_name}`} path={`/bookings/${b.code}`} className="flex flex-col items-center gap-1 py-3">
          <Share2 className="h-5 w-5" />
        </ShareButton>
        {canCancel(b) && <CancelButton code={b.code} className="flex w-full flex-col items-center gap-1 py-3 text-red-700" />}
      </div>
    </div>
  );
}
