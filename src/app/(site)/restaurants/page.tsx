import Link from "next/link";
import { SlidersHorizontal, SearchX, Search as SearchIcon, X } from "lucide-react";
import { PRICE_BANDS, getOpenSlots, searchRestaurants } from "@/lib/restaurants";
import { CITIES, CUISINES, FOOD_TYPES } from "@/lib/constants";
import { RestaurantCard } from "@/components/RestaurantCard";
import { FilterSheet } from "@/components/FilterSheet";
import { FoodMark } from "@/components/FoodMark";
import type { FoodType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Restaurants | CheckInn" };

type Search = { city?: string; cuisine?: string; q?: string; sort?: string; price?: string; food?: string };

export default async function RestaurantsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const results = await searchRestaurants(sp);
  const open = await getOpenSlots(results);
  const food = sp.food === "veg" || sp.food === "nonveg" ? (sp.food as FoodType) : undefined;
  const heading = [food && FOOD_TYPES[food], sp.cuisine, sp.q && `"${sp.q}"`].filter(Boolean).join(" · ") || "Restaurants";

  /** Link to this page with some filters changed (undefined removes one). */
  const withParams = (changes: Partial<Search>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...changes })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/restaurants?${qs}` : "/restaurants";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 md:py-10">
      {/* Phones: pinned search, filters and quick chips */}
      <div className="sticky top-16 z-30 -mx-4 border-b border-black/5 bg-cream/95 px-4 pt-3 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 md:hidden">
        <div className="flex gap-2">
          <form action="/restaurants" className="flex flex-1 items-center gap-2 rounded-xl border border-black/10 bg-white px-3">
            {(["city", "cuisine", "sort", "price", "food"] as const).map((k) => sp[k] && <input key={k} type="hidden" name={k} value={sp[k]} />)}
            <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
            <input
              name="q"
              type="search"
              enterKeyHint="search"
              defaultValue={sp.q}
              aria-label="Search restaurants"
              placeholder="Search restaurants"
              className="w-full bg-transparent py-3 text-base outline-none placeholder:text-muted"
            />
          </form>
          <FilterSheet sp={sp} priceBands={Object.entries(PRICE_BANDS).map(([k, b]) => [k, b.label])} />
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {(["veg", "nonveg"] as const).map((t) => (
            <Chip key={t} href={withParams({ food: food === t ? undefined : t })} on={food === t}>
              <FoodMark type={t} className="h-3.5 w-3.5" /> {FOOD_TYPES[t]}
            </Chip>
          ))}
          <Chip href={withParams({ sort: sp.sort === "offers" ? undefined : "offers" })} on={sp.sort === "offers"}>Offers</Chip>
          <Chip href={withParams({ price: sp.price === "u1000" ? undefined : "u1000" })} on={sp.price === "u1000"}>Under ₹1,000</Chip>
          {sp.cuisine && <Chip href={withParams({ cuisine: undefined })} on>{sp.cuisine}</Chip>}
          {CUISINES.filter((c) => c.name !== sp.cuisine).map((c) => (
            <Chip key={c.name} href={withParams({ cuisine: c.name })}>{c.name}</Chip>
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm text-muted md:hidden">
        <b className="text-ink">{results.length} {results.length === 1 ? "place" : "places"}</b> {sp.q && <>for &ldquo;{sp.q}&rdquo; </>}in {sp.city || "all cities"}
      </p>

      <div className="hidden flex-wrap items-end justify-between gap-4 md:flex">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">{sp.city || "All cities"}</p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{heading}</h1>
          <p className="mt-1 text-muted">{results.length} places to book</p>
        </div>
      </div>

      <form className="mt-8 hidden gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:grid-cols-2 md:grid lg:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Search by name, cuisine or area"
          className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-brand-500"
        />
        <select name="city" defaultValue={sp.city ?? ""} className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-brand-500">
          <option value="">All cities</option>
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select name="cuisine" defaultValue={sp.cuisine ?? ""} className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-brand-500">
          <option value="">All cuisines</option>
          {CUISINES.map((c) => <option key={c.name}>{c.name}</option>)}
        </select>
        <select name="food" defaultValue={food ?? ""} className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-brand-500">
          <option value="">Veg &amp; non-veg</option>
          <option value="veg">Pure veg only</option>
          <option value="nonveg">Non-veg</option>
        </select>
        <select name="sort" defaultValue={sp.sort ?? ""} className="rounded-xl border border-black/10 px-4 py-2.5 outline-none focus:border-brand-500">
          <option value="">Recommended</option>
          <option value="rating">Top rated</option>
          <option value="offers">Best offers</option>
          <option value="price_low">Price: low to high</option>
          <option value="price_high">Price: high to low</option>
        </select>
        <button className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700">
          <SlidersHorizontal className="h-4 w-4" /> Apply
        </button>
      </form>

      {results.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:mt-10 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((r) => <RestaurantCard key={r.id} r={r} open={open[r.id]} />)}
        </div>
      ) : (
        <div className="mt-20 flex flex-col items-center text-center">
          <SearchX className="h-12 w-12 text-muted" />
          <h2 className="mt-4 font-display text-2xl font-bold">No restaurants found</h2>
          <p className="mt-1 text-muted">Try a different city, cuisine or search term.</p>
          <Link href="/restaurants" className="mt-6 rounded-full bg-brand-600 px-6 py-2.5 font-semibold text-white">Clear filters</Link>
        </div>
      )}
    </div>
  );
}

function Chip({ href, on = false, children }: { href: string; on?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${on ? "border-brand-600 bg-brand-600 text-white" : "border-black/10 bg-white"}`}
    >
      {children}
      {on && <X className="h-3.5 w-3.5" />}
    </Link>
  );
}
