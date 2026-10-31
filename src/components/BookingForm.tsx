"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Minus, Plus, Loader2, CalendarDays, Crown, UserRound, X, Ticket, BadgePercent, Check } from "lucide-react";
import { createBooking, releaseBooking, type CouponPreview, type FormState, type UpiRequest } from "@/app/actions";
import { couponDiscount, inr } from "@/lib/constants";
import { paperBlast } from "@/lib/paperBlast";
import { UpiPayDialog } from "./UpiPayDialog";
import { fmtDate, fmtTime, nowInIndia } from "@/lib/time";

interface Props {
  /** fee: table booking fee per guest, in rupees. */
  restaurant: { id: number; name: string; capacity: number; discount: number; fee: number };
  /** Collect the fee now by UPI QR; otherwise it's paid at the restaurant. */
  payOnline: boolean;
  slots: string[];
  dates: string[];
  memberExtra: number;
  user: { name: string; phone: string; email: string } | null;
  /** Offers the guest can use (their scratch-card wins are "mine"); the best one that fits is applied automatically. */
  coupons?: (CouponPreview & { mine?: boolean })[];
  /** Preselected from "open tables" links (?date=&slot=). */
  initialDate?: string;
  initialSlot?: string;
  /** Closes the phone booking sheet (the close button is hidden on larger screens). */
  onClose?: () => void;
}

export function BookingForm({ restaurant, payOnline, slots, dates, memberExtra, user, coupons = [], initialDate, initialSlot, onClose }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createBooking, undefined);
  const [payError, setPayError] = useState<string>();
  const [date, setDate] = useState(initialDate && dates.includes(initialDate) ? initialDate : dates[0]);
  const [slot, setSlot] = useState(initialSlot && slots.includes(initialSlot) ? initialSlot : "");
  // Phones: one meal at a time, and saved details collapsed into a single line.
  const [meal, setMeal] = useState<string | null>(null);
  const [editDetails, setEditDetails] = useState(false);
  const [guests, setGuests] = useState(2);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [blocked, setBlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/availability?restaurantId=${restaurant.id}&date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setUsage(d.usage ?? {});
        setBlocked(d.blocked ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setUsage({});
        setBlocked([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, restaurant.id]);

  // Our own UPI QR: show it until the guest enters the UTR (which redirects) or closes it.
  const [upi, setUpi] = useState<UpiRequest | null>(null);
  useEffect(() => setUpi(state?.upi ?? null), [state]);

  const now = nowInIndia();
  const slotState = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    if (date === now.date && h * 60 + m <= now.minutes + 30) return { ok: false, label: "" };
    if (blocked.includes(s)) return { ok: false, label: "Closed" };
    const left = restaurant.capacity - (usage[s] ?? 0);
    if (left < guests) return { ok: false, label: "Full" };
    return { ok: true, label: left <= 8 ? `${left} left` : "" };
  };

  // Drop a selected slot that becomes unavailable after changing date / party size.
  useEffect(() => {
    if (slot && !slotState(slot).ok) setSlot("");
  });

  const groups = [
    { name: "Breakfast & Lunch", items: slots.filter((s) => s < "16:00") },
    { name: "Dinner", items: slots.filter((s) => s >= "16:00") },
  ].filter((g) => g.items.length);
  const totalOff = restaurant.discount + memberExtra;
  const isPast = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return date === now.date && h * 60 + m <= now.minutes + 30;
  };
  const activeMeal =
    meal ?? groups.find((g) => g.items.includes(slot))?.name ?? groups.find((g) => g.items.some((s) => !isPast(s)))?.name ?? groups[0]?.name;
  const detailsCollapsed = Boolean(user?.name && user.phone) && !editDetails;
  const guestLabel = `${guests} ${guests === 1 ? "guest" : "guests"}`;
  const fee = restaurant.fee * guests;
  // Offers apply on their own: the biggest saving for this party, unless the guest picked another one that fits.
  const [picked, setPicked] = useState<string | null>(null);
  const eligible = coupons.filter((c) => guests >= c.min_guests && couponDiscount(c, fee) > 0).sort((a, b) => couponDiscount(b, fee) - couponDiscount(a, fee));
  const coupon = eligible.find((c) => c.code === picked) ?? eligible[0] ?? null;
  const off = coupon ? couponDiscount(coupon, fee) : 0;
  const toPay = fee - off;
  const payNow = payOnline && toPay > 0;
  const busy = pending || Boolean(upi);
  const error = payError ?? state?.error;

  return (
    <>
    {upi && (
      <UpiPayDialog
        upi={upi}
        summary={`${restaurant.name} · ${fmtDate(date)}, ${fmtTime(slot)} · ${guestLabel}`}
        onCancel={() => {
          releaseBooking(upi.code);
          setUpi(null);
          setPayError("Payment cancelled, so your table isn't booked yet.");
        }}
      />
    )}
    <form
      action={formAction}
      // Submit by hand so React doesn't clear the guest's details: they're still needed if the payment is cancelled.
      onSubmit={(e) => {
        e.preventDefault();
        setPayError(undefined);
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="rounded-t-[1.75rem] bg-white ring-1 ring-black/5 md:overflow-hidden md:rounded-3xl md:shadow-xl">
      <div className="relative rounded-t-[1.75rem] bg-brand-600 px-6 py-5 text-white md:rounded-none">
        <div className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-white/30 md:hidden" />
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-5 grid h-9 w-9 place-items-center rounded-full bg-white/15 md:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
        <p className="text-sm text-white/75 md:hidden">{restaurant.name}</p>
        <p className="flex items-center gap-2 font-display text-xl font-bold">
          <CalendarDays className="h-5 w-5 text-gold-300" /> Reserve a table
        </p>
        {totalOff > 0 && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gold-300">
            {memberExtra > 0 && <Crown className="h-4 w-4" />} Flat {totalOff}% off your bill
          </p>
        )}
      </div>

      <div className="space-y-6 p-6">
        <input type="hidden" name="restaurantId" value={restaurant.id} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="slot" value={slot} />
        <input type="hidden" name="guests" value={guests} />

        <div>
          <Label>Date</Label>
          <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6">
            {dates.map((d, i) => {
              const active = d === date;
              return (
                <button
                  type="button"
                  key={d}
                  aria-pressed={active}
                  onClick={() => setDate(d)}
                  className={`flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 text-sm transition ${active ? "border-brand-600 bg-brand-600 text-white" : "border-black/10 hover:border-brand-500"}`}
                >
                  <span className={`text-xs ${active ? "text-white/80" : "text-muted"}`}>
                    {i === 0 ? "Today" : fmtDate(d, { weekday: "short" })}
                  </span>
                  <span className="text-lg font-bold">{fmtDate(d, { day: "numeric" })}</span>
                  <span className={`text-xs ${active ? "text-white/80" : "text-muted"}`}>{fmtDate(d, { month: "short" })}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Guests</Label>
          <div className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-2">
            <button type="button" onClick={() => setGuests(Math.max(1, guests - 1))} className="rounded-full p-3 hover:bg-sand md:p-1.5" aria-label="Fewer guests">
              <Minus className="h-4 w-4" />
            </button>
            <span className="font-semibold">{guests} {guests === 1 ? "guest" : "guests"}</span>
            <button type="button" onClick={() => setGuests(Math.min(20, guests + 1))} className="rounded-full p-3 hover:bg-sand md:p-1.5" aria-label="More guests">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div>
          <Label>Time {loading && <Loader2 className="ml-1 inline h-3.5 w-3.5 animate-spin" />}</Label>
          {groups.length > 1 && (
            <div role="tablist" className="mb-3 flex gap-1 rounded-xl bg-sand p-1 md:hidden">
              {groups.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  role="tab"
                  aria-selected={g.name === activeMeal}
                  onClick={() => setMeal(g.name)}
                  className={`flex-1 rounded-lg py-2 text-[13px] font-semibold ${g.name === activeMeal ? "bg-white text-ink shadow-sm" : "text-muted"}`}
                >
                  {g.name === "Dinner" ? "Dinner" : "Lunch"} · {fmtTime(g.items[0])}
                </button>
              ))}
            </div>
          )}
          {groups.map((g) => (
            <div key={g.name} className={`mb-3 ${g.name === activeMeal ? "" : "hidden md:block"}`}>
              <p className="mb-2 hidden text-xs font-medium text-muted md:block">{g.name}</p>
              <div className="grid grid-cols-3 gap-2">
                {g.items.map((s) => {
                  const st = slotState(s);
                  const active = s === slot;
                  return (
                    <button
                      type="button"
                      key={s}
                      aria-pressed={active}
                      disabled={!st.ok || loading}
                      onClick={() => setSlot(s)}
                      className={`rounded-lg border px-1 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? "border-brand-600 bg-brand-600 text-white" : "border-black/10 hover:border-brand-500"}`}
                    >
                      {fmtTime(s)}
                      {st.label && <span className={`block text-[10px] ${active ? "text-white/80" : "text-brand-500"}`}>{st.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {detailsCollapsed && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-black/15 px-4 py-3 text-sm text-muted md:hidden">
            <UserRound className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Booking as <b className="text-ink">{user!.name}</b> · {user!.phone}
            </span>
            <button type="button" onClick={() => setEditDetails(true)} className="font-semibold text-brand-600">
              Edit
            </button>
          </div>
        )}
        <div className={`space-y-3 ${detailsCollapsed ? "hidden md:block" : ""}`}>
          <Label>Your details</Label>
          <Input name="name" placeholder="Full name" defaultValue={user?.name} required />
          <Input name="phone" type="tel" placeholder="Mobile number" defaultValue={user?.phone} required />
          <Input name="email" type="email" placeholder="Email (for confirmation)" defaultValue={user?.email} />
          <textarea
            name="request"
            rows={2}
            placeholder="Special request (birthday, window seat…)"
            className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-base md:text-sm outline-none focus:border-brand-500"
          />
        </div>

        {fee > 0 && (
          <div className="rounded-xl bg-sand px-4 py-3 text-sm">
            <p className="flex items-center justify-between gap-3 font-semibold">
              <span className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-brand-600" /> Table booking fee
              </span>
              <span>
                {off > 0 && <s className="mr-1.5 font-normal text-muted">{inr(fee)}</s>}
                {toPay > 0 ? inr(toPay) : "Free"}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {inr(restaurant.fee)} × {guestLabel}
              {toPay > 0 && ` · ${payNow ? "paid now to confirm your table" : "pay at the restaurant"} · non-refundable`}
            </p>
            {coupon && <AppliedOffer fee={fee} offers={eligible} applied={coupon} onPick={setPicked} />}
            <input type="hidden" name="coupon" value={coupon?.code ?? ""} />
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        <div className="sticky bottom-0 -mx-6 border-t border-black/5 bg-white px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:static md:mx-0 md:border-0 md:p-0">
          <button
            disabled={busy || !slot}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            <span className="md:hidden">
              {slot ? `${payNow ? `Pay ${inr(toPay)}` : "Confirm"} · ${fmtDate(date)}, ${fmtTime(slot)}` : "Select a time"}
            </span>
            <span className="hidden md:inline">
              {slot ? `${payNow ? `Pay ${inr(toPay)} · ` : ""}Book for ${fmtDate(date)}, ${fmtTime(slot)}` : "Select a time"}
            </span>
          </button>
        </div>
        {!user && <p className="text-center text-xs text-muted">Sign in to manage or cancel bookings later.</p>}
      </div>
    </form>
    </>
  );
}

/** The offer applied to this booking, and the other offers that fit to switch to. */
function AppliedOffer({
  fee,
  offers,
  applied,
  onPick,
}: {
  fee: number;
  offers: (CouponPreview & { mine?: boolean })[];
  applied: CouponPreview;
  onPick: (code: string) => void;
}) {
  const others = offers.filter((c) => c.code !== applied.code);
  const box = useRef<HTMLDivElement>(null);
  // Celebrate each offer once it's on screen: when the form first shows it, and whenever another one is applied.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        paperBlast(el);
      },
      { threshold: 1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [applied.code]);
  return (
    <div className="mt-3 border-t border-black/5 pt-3">
      <div ref={box} className="flex items-center gap-3 rounded-lg border border-dashed border-brand-500/40 bg-white px-3 py-2">
        <BadgePercent className="h-5 w-5 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1">
          <p className="leading-snug font-semibold text-brand-600 [font-variant-numeric:lining-nums]">{applied.title}</p>
          <p className="flex items-center gap-1 text-xs text-muted">
            <Check className="h-3.5 w-3.5 text-brand-600" /> Applied automatically
          </p>
        </div>
        <span className="shrink-0 font-semibold text-brand-600">−{inr(couponDiscount(applied, fee))}</span>
      </div>
      {others.length > 0 && (
        <div className="no-scrollbar -mx-1 mt-2 flex items-center gap-2 overflow-x-auto px-1">
          <span className="shrink-0 text-xs text-muted">Or use</span>
          {others.slice(0, 3).map((c) => (
            <button
              type="button"
              key={c.code}
              onClick={() => onPick(c.code)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-brand-500/50 bg-white px-3 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
            >
              {c.mine && <span className="rounded-full bg-gold-300 px-1.5 text-[10px] text-gold-600">Won</span>}
              {c.title} · −{inr(couponDiscount(c, fee))}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-sm font-semibold">{children}</p>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-base outline-none focus:border-brand-500 md:text-sm" />;
}
