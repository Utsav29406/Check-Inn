"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, CalendarDays, IndianRupee, LayoutDashboard, Store, TicketPercent, Users } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/slots", label: "Slots", icon: CalendarClock },
  { href: "/admin/restaurants", label: "Restaurants", icon: Store },
  { href: "/admin/offers", label: "Offers", icon: TicketPercent },
  { href: "/admin/users", label: "Users & partners", icon: Users },
  { href: "/admin/payments", label: "UPI payments", icon: IndianRupee },
];

/** Sidebar from 768px up, a scrollable tab row on phones. "UPI payments" only shows while UPI QR payments are on. */
export function AdminNav({ upi }: { upi: boolean }) {
  const pathname = usePathname();
  const items = upi ? ITEMS : ITEMS.filter((i) => i.href !== "/admin/payments");
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
        </Link>
      ))}
    </nav>
  );
}
