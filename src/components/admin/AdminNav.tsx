"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, CalendarDays, ClipboardCheck, IndianRupee, LayoutDashboard, Store, TicketPercent, Users } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/slots", label: "Slots", icon: CalendarClock },
  { href: "/admin/restaurants", label: "Restaurants", icon: Store },
  { href: "/admin/listings", label: "Listings", icon: ClipboardCheck },
  { href: "/admin/offers", label: "Offers", icon: TicketPercent },
  { href: "/admin/users", label: "Users & partners", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: IndianRupee },
];

/**
 * Sidebar from 768px up, a scrollable tab row on phones. Listings and Payments show how many are waiting to be checked.
 */
export function AdminNav({ pendingListings = 0, paymentsToCheck = 0 }: { pendingListings?: number; paymentsToCheck?: number }) {
  const pathname = usePathname();
  const items = ITEMS;
  const badge: Record<string, number> = { "/admin/listings": pendingListings, "/admin/payments": paymentsToCheck };
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:px-3 md:pb-0">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
            active(href) ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Icon className={`h-4.5 w-4.5 ${active(href) ? "text-gold-300" : ""}`} />
          {label}
          {badge[href] > 0 && <span className="ml-auto rounded-full bg-gold-400 px-2 text-[11px] font-bold text-brand-900">{badge[href]}</span>}
        </Link>
      ))}
    </nav>
  );
}
