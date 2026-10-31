import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import type { Restaurant } from "@/lib/types";
import type { OpenSlots } from "@/lib/restaurants";
import { inr } from "@/lib/constants";
import { fmtTime } from "@/lib/time";
import { SafeImage } from "./SafeImage";
import { FoodMark } from "./FoodMark";

export function RestaurantCard({ r, open }: { r: Restaurant; open?: OpenSlots }) {
  return (
    <article className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <Link href={`/restaurants/${r.slug}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden md:aspect-[4/3]">
          <SafeImage
            src={r.image_url}
            alt={r.name}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent" />
          {r.discount_percent > 0 && (
            <span className="absolute left-3 top-3 rounded-full bg-gold-400 px-3 py-1 text-xs font-bold text-ink shadow">
              Flat {r.discount_percent}% off
            </span>
          )}
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-sm font-semibold text-ink">
            <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" /> {r.rating.toFixed(1)}
          </span>
        </div>
        <div className="p-4">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink transition group-hover:text-brand-600">
            <FoodMark type={r.food_type} />
            <span className="min-w-0">{r.name}</span>
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted">{r.cuisines}</p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted">
              <MapPin className="h-3.5 w-3.5" /> {r.area}, {r.city}
            </span>
            <span className="font-medium text-ink">{inr(r.price_for_two)} for two</span>
          </div>
        </div>
      </Link>
      {open && <OpenSlotLinks slug={r.slug} open={open} className="-mt-1 px-4 pb-4 md:hidden" />}
    </article>
  );
}

/** Tap-to-book times: each opens the restaurant page with the booking sheet on that time. */
export function OpenSlotLinks({ slug, open, className = "", label = true }: { slug: string; open: OpenSlots; className?: string; label?: boolean }) {
  if (!open.slots.length) return null;
  return (
    <div className={className}>
      {label && (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Open tables {open.today ? "today" : "tomorrow"}
        </p>
      )}
      <div className={`flex flex-wrap gap-1.5 ${label ? "mt-2" : ""}`}>
        {open.slots.map((s) => (
          <Link
            key={s}
            href={`/restaurants/${slug}?date=${open.date}&slot=${s}`}
            className="rounded-lg border border-brand-600 px-2.5 py-1 text-xs font-semibold text-brand-600 transition active:bg-brand-600 active:text-white"
          >
            {fmtTime(s)}
          </Link>
        ))}
      </div>
    </div>
  );
}
