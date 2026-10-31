import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { daysUntil, type Festival } from "@/lib/festival";
import { Diya } from "./Art";

export const countdown = (f: Festival) => {
  const d = daysUntil(f);
  return d > 1 ? `Diwali in ${d} days` : d === 1 ? "Diwali is tomorrow" : "Happy Diwali!";
};

/** The strip above the top bar while the Diwali theme is on. */
export function DiwaliBanner({ festival }: { festival: Festival }) {
  return (
    <Link href="/offers" className="block border-b border-gold-400/30 bg-brand-900 text-gold-300">
      <span className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-[13px] sm:px-6">
        <Diya className="-mt-1 h-6 w-6 shrink-0" />
        <b className="shrink-0 font-semibold text-white">{countdown(festival)}</b>
        <span className="hidden md:inline">
          · Shagun from us: up to a <b className="text-white">free table booking</b> when you book
        </span>
        <span className="truncate md:hidden">
          · Diwali offers when you book
        </span>
        <span className="ml-1 hidden shrink-0 font-semibold underline-offset-2 hover:underline md:inline">See offers →</span>
        <ChevronRight className="h-4 w-4 shrink-0 md:hidden" />
      </span>
    </Link>
  );
}

/** Reminds whoever opened the preview link that only their browser sees the theme. */
export function PreviewPill() {
  return (
    <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-60 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full bg-ink/90 py-1.5 pr-1.5 pl-3 text-xs text-white shadow-xl backdrop-blur md:bottom-6">
      <Diya className="h-5 w-5" />
      <span>
        <b>Diwali preview</b> · only you see this
      </span>
      <a href="/api/preview?festival=off" className="rounded-full bg-white/15 px-3 py-1 font-semibold hover:bg-white/25">
        Exit
      </a>
    </div>
  );
}

