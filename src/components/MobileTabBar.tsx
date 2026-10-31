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

/** Phone-only bottom navigation. Hidden on restaurant pages, which show a "Book a table" bar instead. */
export function MobileTabBar() {
  const pathname = usePathname();
  if (/^\/restaurants\/[^/]+$/.test(pathname)) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-black/5 bg-cream/95 px-2 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
      {TABS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-1 text-[11px] ${active ? "font-bold text-brand-600" : "font-medium text-muted"}`}
          >
            <Icon className="h-5.5 w-5.5" strokeWidth={active ? 2.3 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
