import Link from "next/link";
import { ArrowRight, CalendarCheck, Crown, Search, Sparkles, Star, Utensils, BadgePercent, MapPin } from "lucide-react";
import { getCityOffers, getCityPopular, getFeatured, getOpenSlots, getTopOffers } from "@/lib/restaurants";
import { CITIES, CUISINES, PLANS, couponBenefit, inr, unsplash } from "@/lib/constants";
import { RestaurantCard } from "@/components/RestaurantCard";
import { MobileHome } from "@/components/MobileHome";
import { Reveal } from "@/components/Reveal";
import { SafeImage } from "@/components/SafeImage";
import { Diya, Mandala, Sparkle } from "@/components/diwali/Art";
import { countdown } from "@/components/diwali/Chrome";
import { getFestival } from "@/lib/festival";
import { getPublicOffers } from "@/lib/offers";
import { fmtDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: Search, title: "Discover", text: "Browse handpicked restaurants by city, cuisine, price or the best offers tonight." },
  { icon: CalendarCheck, title: "Reserve instantly", text: "Pick a date, time and party size. Your table is confirmed in seconds — no calls." },
  { icon: BadgePercent, title: "Dine & save", text: "Show your booking code at the restaurant and enjoy flat discounts on your bill." },
];

const TESTIMONIALS = [
  { name: "Aanya Mehta", city: "Mumbai", text: "Booked Sakura Room for our anniversary in under a minute. The Gold membership already paid for itself." },
  { name: "Rohan Desai", city: "Ahmedabad", text: "Finally a booking app that feels premium. The flat discounts on weekend dinners are genuinely great." },
  { name: "Ishita Rao", city: "Bengaluru", text: "I love discovering new places by cuisine. Club events have become our favourite monthly plan." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const sp = await searchParams;
  const city = (CITIES as readonly string[]).includes(sp.city ?? "") ? sp.city! : "Ahmedabad";
  const [featured, offers, cityOffers, popular, festival] = await Promise.all([
    getFeatured(),
    getTopOffers(),
    getCityOffers(city),
    getCityPopular(city),
    getFestival(),
  ]);
  const [open, specials] = await Promise.all([
    getOpenSlots(popular),
    festival ? getPublicOffers(festival.key).then((list) => list.filter((o) => o.festival)) : [],
  ]);

  return (
    <>
      <MobileHome
        city={city}
        offers={cityOffers.length ? cityOffers : offers}
        popular={popular}
        open={open}
        festival={festival && { countdown: countdown(festival), ends: fmtDate(festival.ends, { day: "numeric", month: "short" }) }}
      />
      <div className="hidden md:block">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 -z-10">
          <SafeImage
            src={unsplash("photo-1414235077428-338989a2e8c0", 2000)}
            alt="Fine dining table"
            className="animate-ken-burns h-full w-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-linear-to-b from-brand-900/70 via-ink/60 to-ink" />
        </div>
        {festival && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(55%_60%_at_85%_100%,rgba(214,191,138,.2),transparent_70%)]" />
            <Mandala className="animate-spin-slow absolute top-1/2 -right-36 h-140 w-140 -translate-y-1/2 text-gold-400 opacity-20" />
            <Sparkle className="absolute top-24 right-[30%] h-4 w-4" />
            <Sparkle className="absolute top-44 right-[12%] h-3 w-3" delay={1.1} />
            <Sparkle className="absolute right-[24%] bottom-40 h-5 w-5" delay={2} />
            <Sparkle className="absolute top-16 right-[6%] h-3 w-3" delay={0.6} />
            <div className="absolute right-[12%] bottom-12 flex items-end gap-6">
              {[0.1, 0.6, 0.3].map((d, i) => (
                <Diya key={i} delay={d} className={i === 1 ? "h-16 w-16" : "h-12 w-12"} />
              ))}
            </div>
          </div>
        )}
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 md:pb-32 md:pt-28">
          <Reveal>
            {festival ? (
              <Link
                href="/offers"
                className="inline-flex items-center gap-2 rounded-full border border-gold-400/50 bg-white/5 py-1 pr-4 pl-2 text-sm text-gold-300 backdrop-blur transition hover:bg-white/10"
              >
                <Diya className="-mt-1 h-7 w-7" /> {countdown(festival)} · Diwali specials are here <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-white/5 px-4 py-1.5 text-sm text-gold-300 backdrop-blur">
                <Sparkles className="h-4 w-4" /> India&apos;s premium dining club
              </span>
            )}
          </Reveal>
          <Reveal delay={100}>
            {festival ? (
              <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl">
                Celebrate Diwali at the city&apos;s <span className="text-gradient-gold italic">finest tables</span>.
              </h1>
            ) : (
              <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl">
                Reserve the city&apos;s <span className="text-gradient-gold italic">finest tables</span>, in seconds.
              </h1>
            )}
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-5 max-w-xl text-lg text-white/75">
              {festival
                ? "Book the festive dinner everyone remembers. Shagun from us: up to a free table booking, taken off when you book."
                : "Instant confirmations, flat discounts up to 25% and members-only experiences at the best restaurants near you."}
            </p>
          </Reveal>
          <Reveal delay={300}>
            <form action="/restaurants" className="mt-10 flex max-w-3xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl sm:flex-row">
              <label className="flex items-center gap-2 rounded-xl px-3 text-ink sm:w-48 sm:border-r sm:border-black/10">
                <MapPin className="h-5 w-5 shrink-0 text-brand-600" />
                <select name="city" defaultValue="" className="w-full bg-transparent py-3 font-medium outline-none">
                  <option value="">All cities</option>
                  {CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 items-center gap-2 px-3 text-ink">
                <Search className="h-5 w-5 shrink-0 text-muted" />
                <input
                  name="q"
                  placeholder="Search restaurant, cuisine or area…"
                  className="w-full bg-transparent py-3 outline-none placeholder:text-muted"
                />
              </label>
              <button className="rounded-xl bg-brand-600 px-8 py-3 font-semibold text-white transition hover:bg-brand-700">
                Find a table
              </button>
            </form>
          </Reveal>
          <Reveal delay={400}>
            <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-6">
              {[
                ["500+", "Partner restaurants"],
                ["1.2L+", "Happy diners"],
                ["25%", "Max flat discount"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="font-display text-3xl font-bold text-gold-300 sm:text-4xl">{n}</dt>
                  <dd className="mt-1 text-sm text-white/60">{l}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* Cuisines */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="What are you craving?" title="Explore by cuisine" />
        <div className="no-scrollbar -mx-4 mt-10 flex gap-5 overflow-x-auto px-4 pb-2">
          {CUISINES.map((c, i) => (
            <Reveal key={c.name} delay={i * 60} className="shrink-0">
              <Link href={`/restaurants?cuisine=${encodeURIComponent(c.name)}`} className="group block w-36 text-center">
                <div className="mx-auto h-36 w-36 overflow-hidden rounded-full ring-4 ring-white shadow-md transition group-hover:ring-gold-400">
                  <SafeImage src={unsplash(c.image, 300)} alt={c.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                </div>
                <p className="mt-3 font-semibold group-hover:text-brand-600">{c.name}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="bg-sand/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Handpicked for you" title="Featured restaurants" align="left" />
            <Link href="/restaurants" className="flex items-center gap-1 font-semibold text-brand-600 hover:gap-2 transition-all">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((r, i) => (
              <Reveal key={r.id} delay={(i % 4) * 80}>
                <RestaurantCard r={r} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="Simple as 1-2-3" title="How CheckInn works" />
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 120}>
              <div className="relative h-full rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
                <span className="absolute right-6 top-4 font-display text-6xl font-bold text-sand">{i + 1}</span>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <s.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-6 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-muted">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Diwali specials, beside the other deals */}
      {specials.length > 0 && festival && (
        <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
          <Link
            href="/offers"
            className="group relative flex flex-wrap items-center gap-x-8 gap-y-5 overflow-hidden rounded-3xl bg-[radial-gradient(120%_120%_at_100%_0%,#1d6650_0%,#061f19_60%)] px-8 py-7 text-white"
          >
            <Mandala className="absolute -top-24 -right-20 h-72 w-72 text-gold-400 opacity-20" />
            <Diya className="relative h-14 w-14 shrink-0" />
            <div className="relative min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-300">
                {countdown(festival)} · until {fmtDate(festival.ends, { day: "numeric", month: "short" })}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold">Diwali specials</h2>
              <p className="text-sm text-white/70">No codes needed: the best offer comes off automatically when you book.</p>
            </div>
            <ul className="relative flex flex-wrap gap-2">
              {specials.map((o) => (
                <li key={o.id} className="rounded-xl border border-dashed border-gold-400/50 bg-white/5 px-3.5 py-2">
                  <span className="block text-sm font-bold text-gold-300 [font-variant-numeric:lining-nums]">{o.title}</span>
                  <span className="text-xs text-white/70 [font-variant-numeric:lining-nums]">{couponBenefit(o)}</span>
                </li>
              ))}
            </ul>
            <span className="relative flex items-center gap-1 font-semibold text-gold-300 transition-all group-hover:gap-2">
              All offers <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </section>
      )}

      {/* Offers */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Tonight's best deals" title="Top offers" align="left" />
          <Link href="/restaurants?sort=offers" className="flex items-center gap-1 font-semibold text-brand-600 hover:gap-2 transition-all">
            All offers <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {offers.map((r, i) => (
            <Reveal key={r.id} delay={i * 80}>
              <Link href={`/restaurants/${r.slug}`} className="group flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-lg">
                <div className="w-36 shrink-0 overflow-hidden sm:w-48">
                  <SafeImage src={r.image_url} alt={r.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                </div>
                <div className="flex flex-1 flex-col justify-center p-5">
                  <span className="w-fit rounded-md bg-gold-300/50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-gold-600">
                    Flat {r.discount_percent}% off
                  </span>
                  <h3 className="mt-2 font-display text-lg font-bold group-hover:text-brand-600">{r.name}</h3>
                  <p className="text-sm text-muted">{r.area}, {r.city} · {inr(r.price_for_two)} for two</p>
                  <p className="mt-2 flex items-center gap-1 text-sm font-medium">
                    <Star className="h-4 w-4 fill-gold-500 text-gold-500" /> {r.rating.toFixed(1)}
                    <span className="text-muted">({r.reviews_count.toLocaleString("en-IN")} reviews)</span>
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Club */}
      <section className="relative overflow-hidden bg-brand-900 py-24 text-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gold-300">
              <Crown className="h-4 w-4" /> CheckInn Club
            </span>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
              Dine like a <span className="italic text-gold-300">member</span>.
            </h2>
            <p className="mt-5 max-w-lg text-lg text-white/70">
              Stack extra savings on every reservation, get priority prime-time tables and unlock chef&apos;s table
              experiences reserved for club members.
            </p>
            <Link href="/membership" className="mt-8 inline-flex items-center gap-2 rounded-full bg-gold-400 px-7 py-3 font-semibold text-ink transition hover:bg-gold-300">
              Explore memberships <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map((p, i) => (
              <Reveal key={p.tier} delay={i * 120}>
                <div className={`animate-float rounded-2xl border p-6 backdrop-blur ${p.popular ? "border-gold-400 bg-gold-400/10" : "border-white/15 bg-white/5"}`} style={{ animationDelay: `${i * 0.8}s` }}>
                  <p className="text-sm uppercase tracking-widest text-gold-300">{p.name}</p>
                  <p className="mt-3 font-display text-3xl font-bold">{inr(p.price)}</p>
                  <p className="text-sm text-white/60">per year</p>
                  <p className="mt-4 text-sm font-semibold text-gold-300">+{p.extraDiscount}% extra off</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="Loved by diners" title="What our members say" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 120}>
              <figure className="h-full rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star key={k} className="h-4 w-4 fill-gold-500 text-gold-500" />
                  ))}
                </div>
                <blockquote className="mt-4 text-ink/80">&ldquo;{t.text}&rdquo;</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-semibold text-white">
                    {t.name.charAt(0)}
                  </span>
                  <span>
                    <span className="block font-semibold">{t.name}</span>
                    <span className="text-sm text-muted">{t.city}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Partner CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-linear-to-r from-gold-300 to-gold-400 p-10 md:flex-row md:items-center">
            <div className="flex items-center gap-5">
              <div className="hidden h-16 w-16 items-center justify-center rounded-2xl bg-ink text-gold-300 sm:flex">
                <Utensils className="h-8 w-8" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Own a restaurant?</h2>
                <p className="mt-1 text-ink/70">List on CheckInn and fill more tables with diners who love great food.</p>
              </div>
            </div>
            <Link href="/partner" className="rounded-full bg-ink px-7 py-3 font-semibold text-white transition hover:bg-brand-900">
              Partner with us
            </Link>
          </div>
        </Reveal>
      </section>
      </div>
    </>
  );
}

function SectionHeading({ eyebrow, title, align = "center" }: { eyebrow: string; title: string; align?: "center" | "left" }) {
  return (
    <Reveal className={align === "center" ? "text-center" : ""}>
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{title}</h2>
    </Reveal>
  );
}
