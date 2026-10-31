import Link from "next/link";
import { ChevronRight, Crown, Gift, Search, Star } from "lucide-react";
import { CUISINES, FOOD_TYPES, inr, unsplash } from "@/lib/constants";
import type { OpenSlots } from "@/lib/restaurants";
import type { Restaurant } from "@/lib/types";
import { CityPicker } from "./CityPicker";
import { OpenSlotLinks } from "./RestaurantCard";
import { SafeImage } from "./SafeImage";
import { FoodMark } from "./FoodMark";
import { Diya, Mandala, Sparkle } from "./diwali/Art";

/** Phone-only home screen (the desktop home is unchanged). */
export function MobileHome({
  city,
  offers,
  popular,
  open,
  festival,
}: {
  city: string;
  offers: Restaurant[];
  popular: Restaurant[];
  open: Record<number, OpenSlots>;
  /** Set while the Diwali theme is on: the countdown line and the offers' last day. */
  festival?: { countdown: string; ends: string } | null;
}) {
  const q = `city=${encodeURIComponent(city)}`;
  return (
    <div className="pb-6 md:hidden">
      <div className="px-4 pt-4">
        <CityPicker city={city} />
      </div>
      <h1 className="mx-4 mt-4 font-display text-[1.75rem] font-bold leading-tight text-balance">
        {festival ? (
          <>
            Where are you celebrating <span className="italic text-brand-600">Diwali?</span>
          </>
        ) : (
          <>
            Where are you eating <span className="italic text-brand-600">tonight?</span>
          </>
        )}
      </h1>
      <form action="/restaurants" className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 shadow-[0_6px_18px_-12px_rgba(6,31,25,.35)]">
        <input type="hidden" name="city" value={city} />
        <Search className="h-5 w-5 shrink-0 text-muted" />
        <input
          name="q"
          type="search"
          enterKeyHint="search"
          aria-label="Search restaurants"
          placeholder="Restaurants, cuisines or areas"
          className="w-full bg-transparent py-3.5 text-base outline-none placeholder:text-muted"
        />
      </form>
      <div className="mx-4 mt-3 flex gap-2">
        {(["veg", "nonveg"] as const).map((t) => (
          <Link key={t} href={`/restaurants?${q}&food=${t}`} className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-[13px] font-semibold">
            <FoodMark type={t} className="h-3.5 w-3.5" /> {FOOD_TYPES[t]}
          </Link>
        ))}
      </div>

      <div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto px-4 pb-1">
        {CUISINES.map((c) => (
          <Link key={c.name} href={`/restaurants?${q}&cuisine=${encodeURIComponent(c.name)}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center text-xs font-semibold">
            <span className="h-15 w-15 overflow-hidden rounded-full ring-2 ring-white shadow-[0_0_0_3px_rgba(0,0,0,.06)]">
              <SafeImage src={unsplash(c.image, 160)} alt="" className="h-full w-full object-cover" />
            </span>
            {c.name}
          </Link>
        ))}
      </div>

      {festival && (
        <Link
          href="/offers"
          className="relative mx-4 mt-5 block overflow-hidden rounded-[1.25rem] bg-[radial-gradient(120%_120%_at_100%_0%,#1d6650_0%,#061f19_60%)] p-5 text-white"
        >
          <Mandala className="absolute -top-16 -right-16 h-48 w-48 text-gold-400 opacity-35" />
          <Sparkle className="absolute top-5 right-28 h-3 w-3" delay={0.8} />
          <p className="relative text-[11px] font-semibold uppercase tracking-widest text-gold-300">{festival.countdown}</p>
          <h2 className="relative mt-1 max-w-[14rem] font-display text-[1.4rem] leading-tight font-bold">Your table, our Diwali shagun</h2>
          <p className="relative mt-1.5 max-w-[15rem] text-sm text-white/75 [font-variant-numeric:lining-nums]">
            ₹101 off or a free table booking, taken off automatically when you book. Until {festival.ends}.
          </p>
          <span className="relative mt-3 inline-flex items-center gap-1 rounded-full bg-gold-400 px-4 py-2 text-sm font-bold text-brand-900">
            See Diwali offers <ChevronRight className="h-4 w-4" />
          </span>
          <span className="absolute right-4 bottom-3 flex items-end gap-1.5">
            <Diya className="h-9 w-9" delay={0.3} />
            <Diya className="h-12 w-12" />
            <Diya className="h-9 w-9" delay={0.6} />
          </span>
        </Link>
      )}

      {offers.length > 0 && (
        <>
          <SectionHead title="Tonight's offers" href={`/restaurants?${q}&sort=offers`} />
          <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {offers.map((r) => (
              <Link key={r.id} href={`/restaurants/${r.slug}`} className="w-62.5 shrink-0 snap-start overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
                <div className="relative h-32">
                  <SafeImage src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
                  <span className="absolute left-2.5 top-2.5 rounded-lg bg-gold-300 px-2 py-1 text-[11px] font-bold text-brand-900">
                    Flat {r.discount_percent}% off
                  </span>
                </div>
                <div className="px-3.5 py-3">
                  <h3 className="truncate font-semibold">{r.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                    <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />
                    <b className="text-ink">{r.rating.toFixed(1)}</b> · {r.area} · {inr(r.price_for_two)} for two
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionHead title={`Popular in ${city}`} href={`/restaurants?${q}&sort=rating`} />
      <div className="grid gap-3 px-4">
        {popular.map((r) => {
          return (
            <article key={r.id} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-black/5">
              <Link href={`/restaurants/${r.slug}`} className="h-21 overflow-hidden rounded-xl">
                <SafeImage src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
              </Link>
              <div className="min-w-0">
                <Link href={`/restaurants/${r.slug}`} className="block">
                  <h3 className="flex items-start justify-between gap-2 font-semibold">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <FoodMark type={r.food_type} className="h-3.5 w-3.5" />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold">
                      <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />
                      {r.rating.toFixed(1)}
                    </span>
                  </h3>
                  <p className="truncate text-xs text-muted">
                    {r.cuisines} · {r.area}
                  </p>
                </Link>
                {open[r.id] && <OpenSlotLinks slug={r.slug} open={open[r.id]} label={false} className="mt-2" />}
              </div>
            </article>
          );
        })}
      </div>

      <Link href="/membership" className="relative mx-4 mt-7 block overflow-hidden rounded-[1.25rem] bg-[radial-gradient(120%_120%_at_100%_0%,#1d6650_0%,#061f19_60%)] p-5 text-white">
        <Crown className="absolute right-4 top-4 h-8 w-8 text-gold-400" />
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-400">CheckInn Club</p>
        <h2 className="mt-1 font-display text-xl font-bold">Up to 15% extra off at partner restaurants</h2>
        <p className="mt-1 text-sm text-white/75">Priority prime-time tables and members-only tasting nights. From ₹999 a year.</p>
        <span className="mt-3 inline-block rounded-full bg-gold-400 px-4 py-2 text-sm font-bold text-brand-900">See plans</span>
      </Link>

      <Link href="/offers" className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-gold-300/40 px-4 py-3.5 text-sm ring-1 ring-gold-400/40">
        <Gift className="h-6 w-6 shrink-0 text-gold-600" />
        <span className="flex-1">
          <b>Offers &amp; scratch cards</b>
          <span className="block text-muted">Offers taken off when you book, and a scratch card every time</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted" />
      </Link>

      <Link href="/partner" className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-sm">
        <span>
          <b>Own a restaurant?</b> <span className="text-muted">Partner with CheckInn</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted" />
      </Link>
    </div>
  );
}

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="mx-4 mt-7 mb-3 flex items-baseline justify-between">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <Link href={href} className="text-sm font-semibold text-brand-600">
        See all
      </Link>
    </div>
  );
}
