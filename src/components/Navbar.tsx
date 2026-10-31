import Link from "next/link";
import { Crown, LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { Logo } from "./Logo";
import { GoldLights } from "./diwali/Art";

const LINKS = [
  { href: "/restaurants", label: "Restaurants" },
  { href: "/offers", label: "Offers" },
  { href: "/membership", label: "CheckInn Club" },
  { href: "/partner", label: "For Restaurants" },
  { href: "/bookings", label: "My Bookings" },
];

/** festive: string lights hang under the bar while the Diwali theme is on. */
export async function Navbar({ festive = false }: { festive?: boolean }) {
  const user = await getCurrentUser();
  const member = user && user.membership_tier !== "none";
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-cream/85 backdrop-blur-md">
      <nav className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="hidden items-center gap-5 md:flex lg:gap-8">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-ink/80 transition hover:text-brand-600">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {member && <Crown className="h-4 w-4 text-gold-500" />}
                Hi, {user.name.split(" ")[0]}
              </span>
              <form action={logout}>
                <button className="flex items-center gap-1 rounded-full px-3 py-2 text-sm text-muted hover:bg-sand hover:text-ink" title="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium hover:bg-sand">
                Sign in
              </Link>
              <Link href="/signup" className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
                Join free
              </Link>
            </>
          )}
        </div>
        <Link href="/membership" className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-semibold text-brand-600 md:hidden">
          <Crown className="h-4 w-4" /> Club
        </Link>
      </nav>
      {festive && <GoldLights className="absolute inset-x-0 top-full" />}
    </header>
  );
}
