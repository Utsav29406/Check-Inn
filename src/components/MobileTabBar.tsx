"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Compass, House, UserRound } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: House, match: (p: string) => p === "/" },
  { href: "/restaurants", label: "Explore", icon: Compass, match: (p: string) => p.startsWith("/restaurants") },
  { href: "/bookings", label: "Bookings", icon: CalendarDays, match: (p: string) => p.startsWith("/bookings") },
  { href: "/account", label: "Profile", icon: UserRound, match: (p: string) => ["/account", "/login", "/signup"].includes(p) },
];

/**
 * Phone-only bottom navigation. Hidden on restaurant pages, which show a "Book a table" bar instead.
 * Android: Material bar with a pill behind the open tab. iPhone: a frosted glass bar floating above the bottom edge.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  if (/^\/restaurants\/[^/]+$/.test(pathname)) return null;
  return (
    <nav
      className={[
        "fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-black/5 bg-cream/95 px-2 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden",
        "android:border-0 android:bg-[#f1ece1] android:pt-3 android:pb-[calc(0.75rem+env(safe-area-inset-bottom))] android:backdrop-blur-none",
        "ios:inset-x-5 ios:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] ios:h-16 ios:rounded-full ios:border-0 ios:bg-white/70 ios:p-1 ios:shadow-[0_10px_30px_-8px_rgba(0,0,0,.25),inset_0_0_0_.5px_rgba(255,255,255,.7),0_0_0_.5px_rgba(0,0,0,.08)] ios:backdrop-blur-xl ios:backdrop-saturate-[1.8]",
      ].join(" ")}
    >
      {TABS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex flex-col items-center gap-0.5 py-1 text-[11px]",
              "android:gap-1 android:py-0 android:text-xs ios:justify-center ios:gap-px ios:rounded-full ios:py-0 ios:text-[10px] ios:font-semibold",
              active
                ? "font-bold text-brand-600 android:text-brand-700 ios:bg-brand-500/12 ios:text-brand-500"
                : "font-medium text-muted android:text-[#3f4843] ios:text-[#3c3c43]",
            ].join(" ")}
          >
            <span className={`grid place-items-center android:h-8 android:w-16 android:rounded-full ${active ? "android:bg-brand-100" : ""}`}>
              <Icon className="h-5.5 w-5.5" strokeWidth={active ? 2.3 : 1.8} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
