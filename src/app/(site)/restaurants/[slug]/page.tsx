import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clock, IndianRupee, MapPin, Star, Utensils, Check, Share2, Leaf, Ticket } from "lucide-react";
import { getRestaurant, getSimilar, buildSlots, getOpenSlots } from "@/lib/restaurants";
import { getCurrentUser } from "@/lib/auth";
import { FOOD_TYPES, directionsUrl, inr, memberExtraDiscount } from "@/lib/constants";
import { paymentMode } from "@/lib/payments";
import { getUsableCoupons } from "@/lib/offers";
import { getFestival, offerFestival } from "@/lib/festival";
import { addDays, fmtTime, nowInIndia } from "@/lib/time";
import { SafeImage } from "@/components/SafeImage";
import { RestaurantCard } from "@/components/RestaurantCard";
import { BookingPanel } from "@/components/BookingPanel";
import { ShareButton } from "@/components/ShareButton";
import { Tabs } from "@/components/Tabs";
import { FoodMark } from "@/components/FoodMark";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const r = await getRestaurant((await params).slug);
  return { title: r ? `${r.name}, ${r.area} | CheckInn` : "Restaurant | CheckInn" };
}

export default async function RestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string; slot?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const r = await getRestaurant(slug);
  if (!r) notFound();
  const user = await getCurrentUser();
  const [similar, openSlots, coupons] = await Promise.all([getSimilar(r), getOpenSlots([r], 4), r.booking_fee > 0 ? getFestival().then((f) => getUsableCoupons(user?.id ?? null, offerFestival(f))) : []]);
  const open = openSlots[r.id];
  const hours =
    r.break_start && r.break_end
      ? `${fmtTime(r.opening_time)} – ${fmtTime(r.break_start)}, ${fmtTime(r.break_end)} – ${fmtTime(r.closing_time)}`
      : `${fmtTime(r.opening_time)} – ${fmtTime(r.closing_time)}`;
  const highlights = r.highlights ? r.highlights.split(",").map((h) => h.trim()) : [];
  const cuisines = r.cuisines.split(",").map((c) => c.trim());
  const memberExtra = memberExtraDiscount(user?.membership_tier, user?.membership_expires, r.discount_percent);
  const today = nowInIndia().date;
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  return (
    <>
      <section className="relative h-72 overflow-hidden bg-ink md:h-[42vh] md:min-h-72">
        <SafeImage src={r.image_url.replace("w=1200", "w=2000")} alt={r.name} className="animate-ken-burns h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/30 to-transparent" />
        <div className="absolute inset-x-4 top-4 flex justify-between md:hidden">
          <Link href={`/restaurants?city=${r.city}`} aria-label={`${r.city} restaurants`} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <ShareButton title={r.name} path={`/restaurants/${r.slug}`} label="" className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow">
            <Share2 className="h-4.5 w-4.5" />
          </ShareButton>
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto hidden max-w-7xl px-4 pb-8 text-white sm:px-6 md:block">
          <Link href={`/restaurants?city=${r.city}`} className="mb-4 inline-flex items-center gap-1 text-sm text-white/70 hover:text-white">
            <ChevronLeft className="h-4 w-4" /> {r.city} restaurants
          </Link>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">{r.name}</h1>
          <p className="mt-2 text-white/80">{r.cuisines}</p>
        </div>
      </section>

      <div className="relative mx-auto -mt-6 grid max-w-7xl gap-10 rounded-t-[1.75rem] bg-cream px-4 pt-6 pb-8 sm:px-6 *:min-w-0 md:mt-0 md:rounded-none md:bg-transparent md:py-10 lg:grid-cols-[1fr_400px]">
        <div>
          {/* Phones: title, key facts and today's open tables */}
          <div className="md:hidden">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gold-600">
              <FoodMark type={r.food_type} className="h-3.5 w-3.5" />
              <span className="min-w-0 truncate">
                {FOOD_TYPES[r.food_type]} · {cuisines.join(" · ")}
              </span>
            </p>
            <h1 className="mt-1 font-display text-[1.75rem] font-bold leading-tight">{r.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <Star className="h-4 w-4 fill-gold-500 text-gold-500" />
              <b className="text-ink">{r.rating.toFixed(1)}</b> ({r.reviews_count.toLocaleString("en-IN")} reviews) · {r.area}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Fact icon={<Clock className="h-3.5 w-3.5" />} label="Open">
                {hours.split(", ").map((h) => <span key={h} className="block">{h}</span>)}
              </Fact>
              <Fact icon={<IndianRupee className="h-3.5 w-3.5" />} label="Price">
                {inr(r.price_for_two)}
                <span className="block font-normal text-muted">for two</span>
              </Fact>
              <Fact icon={<MapPin className="h-3.5 w-3.5" />} label="Address" wide>
                {r.address}
                <a href={directionsUrl(r.name, r.address, r.latitude, r.longitude)} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs font-semibold text-brand-600">
                  Get directions
                </a>
              </Fact>
            </div>
            {open && open.slots.length > 0 && (
              <div className="mt-4 rounded-2xl bg-brand-50 p-4">
                <p className="text-sm font-semibold">Open tables {open.today ? "today" : "tomorrow"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {open.slots.map((s) => (
                    <Link
                      key={s}
                      href={`/restaurants/${r.slug}?date=${open.date}&slot=${s}`}
                      scroll={false}
                      replace
                      className="rounded-lg border border-brand-600 bg-white px-3 py-1.5 text-sm font-semibold text-brand-600"
                    >
                      {fmtTime(s)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hidden flex-wrap gap-3 md:flex">
            <Chip icon={<Star className="h-4 w-4 fill-gold-500 text-gold-500" />}>
              <b>{r.rating.toFixed(1)}</b> · {r.reviews_count.toLocaleString("en-IN")} reviews
            </Chip>
            <Chip icon={<MapPin className="h-4 w-4 text-brand-600" />}>{r.address}</Chip>
            <Chip icon={<Clock className="h-4 w-4 text-brand-600" />}>
              {hours}
            </Chip>
            <Chip icon={<IndianRupee className="h-4 w-4 text-brand-600" />}>{inr(r.price_for_two)} for two</Chip>
            <Chip icon={<FoodMark type={r.food_type} />}>{FOOD_TYPES[r.food_type]}</Chip>
            <Chip icon={<Ticket className="h-4 w-4 text-brand-600" />}>{inr(r.booking_fee)} booking fee per guest</Chip>
          </div>

          {r.discount_percent > 0 && (
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-dashed border-gold-500 bg-gold-300/20 p-5 md:mt-8">
              <span className="font-display text-3xl font-bold text-gold-600">{r.discount_percent + memberExtra}%</span>
              <div>
                <p className="font-semibold">Flat {r.discount_percent}% off the total bill with every CheckInn booking</p>
                <p className="text-sm text-muted">
                  {memberExtra
                    ? `Includes your extra ${memberExtra}% club member discount.`
                    : <>Club members get up to 15% extra. <Link href="/membership" className="font-semibold text-brand-600 underline">Join the club</Link></>}
                </p>
              </div>
            </div>
          )}

          {/* Phones: About and Highlights as tabs */}
          <Tabs
            className="mt-6 md:hidden"
            tabs={[
              {
                label: "About",
                content: (
                  <div>
                    <p className="leading-relaxed text-ink/80">{r.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {cuisines.map((c) => (
                        <Link key={c} href={`/restaurants?cuisine=${encodeURIComponent(c)}`} className="flex items-center gap-1.5 rounded-full bg-sand px-3.5 py-1.5 text-sm">
                          <Utensils className="h-3.5 w-3.5" /> {c}
                        </Link>
                      ))}
                    </div>
                  </div>
                ),
              },
              ...(highlights.length
                ? [{
                    label: "Highlights",
                    content: (
                      <ul className="grid gap-2.5">
                        {highlights.map((h) => (
                          <li key={h} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-black/5">
                            {/pure veg/i.test(h) ? <Leaf className="h-4 w-4 text-emerald-700" /> : <Check className="h-4 w-4 text-brand-600" />}
                            {h}
                          </li>
                        ))}
                      </ul>
                    ),
                  }]
                : []),
            ]}
          />

          <div className="hidden md:block">
          <h2 className="mt-10 font-display text-2xl font-bold">About</h2>
          <p className="mt-3 leading-relaxed text-ink/80">{r.description}</p>

          {r.highlights && (
            <>
              <h2 className="mt-10 font-display text-2xl font-bold">Highlights</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {r.highlights.split(",").map((h) => (
                  <li key={h} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-black/5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <Check className="h-4 w-4" />
                    </span>
                    {h.trim()}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-10 font-display text-2xl font-bold">Cuisines</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {r.cuisines.split(",").map((c) => (
              <Link key={c} href={`/restaurants?cuisine=${encodeURIComponent(c.trim())}`} className="flex items-center gap-1.5 rounded-full bg-sand px-4 py-1.5 text-sm hover:bg-brand-50 hover:text-brand-600">
                <Utensils className="h-3.5 w-3.5" /> {c.trim()}
              </Link>
            ))}
          </div>
          </div>

          {r.latitude != null && r.longitude != null && (
            <section>
              <h2 className="mt-8 font-display text-xl font-bold md:mt-10 md:text-2xl">Location</h2>
              <iframe
                title={`Map showing ${r.name}`}
                src={`https://maps.google.com/maps?q=${r.latitude},${r.longitude}&z=16&output=embed`}
                loading="lazy"
                className="mt-4 h-64 w-full rounded-2xl border border-black/5 md:h-80"
              />
              <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5 text-muted">
                  <MapPin className="h-4 w-4 shrink-0 text-brand-600" /> {r.address}
                </span>
                <a href={directionsUrl(r.name, r.address, r.latitude, r.longitude)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600">
                  Get directions
                </a>
              </p>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <BookingPanel
            key={`${sp.date}-${sp.slot}`}
            restaurant={{ id: r.id, name: r.name, capacity: r.capacity_per_slot, discount: r.discount_percent, fee: r.booking_fee }}
            payOnline={paymentMode() !== "venue"}
            slots={buildSlots(r)}
            dates={dates}
            memberExtra={memberExtra}
            user={user ? { name: user.name, phone: user.phone ?? "", email: user.email } : null}
            coupons={coupons.map((c) => ({
              code: c.code,
              title: c.title,
              kind: c.kind,
              value: c.value,
              max_discount: c.max_discount,
              min_guests: c.min_guests,
              mine: c.user_id !== null,
            }))}
            initialDate={sp.date}
            initialSlot={sp.slot}
          />
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="bg-sand/60 py-10 md:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="font-display text-2xl font-bold">More in {r.city}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 md:mt-8 md:gap-6 lg:grid-cols-3">
              {similar.map((s) => <RestaurantCard key={s.id} r={s} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-black/5">
      {icon} {children}
    </span>
  );
}

function Fact({ icon, label, wide, children }: { icon: React.ReactNode; label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-black/5 ${wide ? "col-span-2" : ""}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span className="text-brand-600">{icon}</span>
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold leading-snug">{children}</div>
    </div>
  );
}
