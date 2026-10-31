import Link from "next/link";
import { CITIES } from "@/lib/constants";
import { LogoMark } from "./Logo";

export function Footer() {
  return (
    <footer className="hidden bg-brand-900 text-white/70 md:block">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-2xl font-bold text-white">
              Check<span className="italic text-gold-400">Inn</span>
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed">
            Reserve the finest tables in your city, unlock exclusive offers and dine like a member.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-white">Explore</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/restaurants" className="hover:text-gold-300">All restaurants</Link></li>
            <li><Link href="/restaurants?sort=offers" className="hover:text-gold-300">Best offers</Link></li>
            <li><Link href="/membership" className="hover:text-gold-300">CheckInn Club</Link></li>
            <li><Link href="/bookings" className="hover:text-gold-300">My bookings</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white">Cities</h4>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {CITIES.map((c) => (
              <li key={c}><Link href={`/restaurants?city=${c}`} className="hover:text-gold-300">{c}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white">For restaurants</h4>
          <p className="mt-4 text-sm">Fill more tables on weeknights and reach diners who love great food.</p>
          <Link href="/partner" className="mt-4 inline-block rounded-full border border-gold-400 px-5 py-2 text-sm font-semibold text-gold-300 transition hover:bg-gold-400 hover:text-ink">
            Partner with us
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-xs">
        © {new Date().getFullYear()} CheckInn. All rights reserved.
      </div>
    </footer>
  );
}
