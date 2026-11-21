"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { CalendarDays } from "lucide-react";
import { inr } from "@/lib/constants";
import { BookingForm } from "./BookingForm";

type Props = Omit<ComponentProps<typeof BookingForm>, "onClose">;

/**
 * Phones: a pinned "Book a table" bar that opens the booking form as a bottom sheet.
 * From 768px up the form renders inline exactly as before.
 */
export function BookingPanel(form: Props) {
  const [open, setOpen] = useState(Boolean(form.initialSlot));
  const [isPhone, setIsPhone] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open || !isPhone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    // Move focus into the sheet (its close button) for keyboard and screen-reader users, and back to the bar after.
    sheet.current?.querySelector<HTMLElement>("button[aria-label='Close']")?.focus({ preventScroll: true });
    const back = opener.current;
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      back?.focus({ preventScroll: true });
    };
  }, [open, isPhone]);

  return (
    <>
      {/* Android: the fee and a Material "Book a table" button. iPhone: a glass bar floating above the bottom edge. */}
      <div
        className={[
          "fixed inset-x-0 bottom-0 z-40 flex items-center gap-4 border-t border-black/5 bg-cream/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden",
          "android:justify-between",
          "ios:inset-x-4 ios:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] ios:gap-3 ios:rounded-full ios:border-0 ios:bg-white/70 ios:py-1.5 ios:pr-1.5 ios:pl-5 ios:shadow-[0_10px_30px_-8px_rgba(0,0,0,.25),inset_0_0_0_.5px_rgba(255,255,255,.7),0_0_0_.5px_rgba(0,0,0,.08)] ios:backdrop-blur-xl ios:backdrop-saturate-[1.8]",
        ].join(" ")}
      >
        <p className="text-xs text-muted">
          Booking fee
          <span className="block">
            <b className="text-base text-ink">{inr(form.restaurant.fee)}</b> / guest
          </span>
        </p>
        <button
          ref={opener}
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 items-center justify-center gap-3 rounded-xl bg-brand-600 py-3.5 font-semibold text-white active:scale-[.98] android:flex-none android:rounded-2xl android:px-5 android:py-4 android:font-medium android:shadow-[0_3px_8px_rgba(6,31,25,.3)] ios:rounded-full ios:py-4"
        >
          <CalendarDays className="hidden h-5 w-5 android:block" />
          Book a table
        </button>
      </div>
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-brand-900/45 transition-opacity duration-300 md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div
        ref={sheet}
        inert={isPhone && !open}
        role={isPhone ? "dialog" : undefined}
        aria-modal={isPhone ? true : undefined}
        aria-label={isPhone ? "Reserve a table" : undefined}
        className={`no-scrollbar fixed inset-x-0 bottom-0 z-50 max-h-[90vh] supports-[height:100dvh]:max-h-[90dvh] overflow-y-auto overscroll-contain transition-transform duration-450 [transition-timing-function:cubic-bezier(.2,.8,.2,1)] md:static md:z-auto md:max-h-none md:translate-y-0 md:overflow-visible md:transition-none ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <BookingForm {...form} onClose={() => setOpen(false)} />
      </div>
    </>
  );
}
