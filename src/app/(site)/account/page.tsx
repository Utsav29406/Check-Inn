import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronRight, Crown, Gift, LogOut, Store } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PLANS } from "@/lib/constants";
import { fmtDate, nowInIndia } from "@/lib/time";
import { logout } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile | CheckInn" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const plan = PLANS.find((p) => p.tier === user.membership_tier);
  const active = plan && user.membership_expires && user.membership_expires >= nowInIndia().date;

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-8 sm:px-6 md:py-12">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-600 font-display text-2xl font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold">{user.name}</h1>
          <p className="truncate text-sm text-muted">{user.email}</p>
          {user.phone && <p className="text-sm text-muted">{user.phone}</p>}
        </div>
      </div>

      <Link
        href="/membership"
        className="mt-6 flex items-center gap-4 rounded-2xl bg-[radial-gradient(120%_120%_at_100%_0%,#1d6650_0%,#061f19_60%)] p-5 text-white"
      >
        <Crown className="h-8 w-8 shrink-0 text-gold-400" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-400">CheckInn Club</p>
          <p className="font-semibold">
            {active ? `${plan.name} member · until ${fmtDate(user.membership_expires!, { day: "numeric", month: "short", year: "numeric" })}` : "Not a member yet"}
          </p>
          <p className="text-sm text-white/70">{active ? `Extra ${plan.extraDiscount}% off at partner restaurants` : "Up to 15% extra off. See plans"}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/60" />
      </Link>

      <nav className="mt-6 divide-y divide-black/5 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
        <Row href="/bookings" icon={<CalendarDays className="h-5 w-5" />}>My bookings</Row>
        <Row href="/offers" icon={<Gift className="h-5 w-5" />}>Offers &amp; scratch cards</Row>
        <Row href="/membership" icon={<Crown className="h-5 w-5" />}>CheckInn Club</Row>
        <Row href="/partner" icon={<Store className="h-5 w-5" />}>Partner with us</Row>
      </nav>

      <form action={logout} className="mt-6">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white py-3.5 font-semibold text-red-700">
          <LogOut className="h-5 w-5" /> Sign out
        </button>
      </form>
    </div>
  );
}

function Row({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-4 font-medium">
      <span className="text-brand-600">{icon}</span>
      <span className="flex-1">{children}</span>
      <ChevronRight className="h-4 w-4 text-muted" />
    </Link>
  );
}
