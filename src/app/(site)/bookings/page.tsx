import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarX } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getUserBookings } from "@/lib/bookings";
import { fmtDate, fmtTime, nowInIndia } from "@/lib/time";
import { SafeImage } from "@/components/SafeImage";
import { MobileBookings } from "@/components/MobileBookings";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "My bookings | CheckInn" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/bookings");
  const bookings = await getUserBookings(user.id);
  const today = nowInIndia().date;
  const upcoming = bookings.filter((b) => b.status === "confirmed" && b.booking_date >= today).reverse();
  const past = bookings.filter((b) => !upcoming.includes(b));

  const { tab } = await searchParams;

  return (
    <>
    <MobileBookings upcoming={upcoming} past={past} tab={tab === "past" ? "past" : "upcoming"} />
    <div className="mx-auto hidden max-w-4xl px-4 py-12 sm:px-6 md:block">
      <h1 className="font-display text-4xl font-bold">My bookings</h1>
      {bookings.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <CalendarX className="h-12 w-12 text-muted" />
          <h2 className="mt-4 font-display text-2xl font-bold">No bookings yet</h2>
          <p className="mt-1 text-muted">Your next great meal is a few taps away.</p>
          <Link href="/restaurants" className="mt-6 rounded-full bg-brand-600 px-6 py-2.5 font-semibold text-white">Find a table</Link>
        </div>
      ) : (
        <>
          <Group title="Upcoming" items={upcoming} />
          <Group title="Past & cancelled" items={past} muted />
        </>
      )}
    </div>
    </>
  );
}

function Group({ title, items, muted }: { title: string; items: Booking[]; muted?: boolean }) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-brand-600">{title}</h2>
      <div className="mt-4 space-y-4">
        {items.map((b) => (
          <Link key={b.id} href={`/bookings/${b.code}`} className={`flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md ${muted ? "opacity-70" : ""}`}>
            <SafeImage src={b.restaurant_image} alt={b.restaurant_name} className="w-28 shrink-0 object-cover sm:w-40" />
            <div className="flex flex-1 flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h3 className="font-display text-lg font-bold">{b.restaurant_name}</h3>
                <p className="text-sm text-muted">{b.restaurant_area}, {b.restaurant_city}</p>
                <p className="mt-2 text-sm font-medium">
                  {fmtDate(b.booking_date)} · {fmtTime(b.slot_time)} · {b.guests} guests
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${b.status === "cancelled" ? "bg-black/5 text-muted" : "bg-emerald-50 text-emerald-700"}`}>
                {b.status === "cancelled" ? "Cancelled" : b.code}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
