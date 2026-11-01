import { TrendingUp, Users, LayoutDashboard } from "lucide-react";
import { ListingForm } from "@/components/ListingForm";
import { Reveal } from "@/components/Reveal";

export const metadata = { title: "Partner with us | CheckInn" };

const BENEFITS = [
  { icon: Users, title: "Reach premium diners", text: "Get discovered by thousands of food lovers and club members in your city." },
  { icon: TrendingUp, title: "Fill quiet slots", text: "Use targeted offers to drive footfall on weekdays and off-peak hours." },
  { icon: LayoutDashboard, title: "Zero-hassle bookings", text: "Instant confirmations with capacity control — no more phone tag." },
];

export default function PartnerPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">For restaurants</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">
            Grow your restaurant with <span className="italic text-brand-600">CheckInn</span>
          </h1>
          <p className="mt-4 text-lg text-muted">List your restaurant in a few minutes. We check every listing, and once it&apos;s approved, guests can book your tables.</p>
        </Reveal>
        <div className="mt-10 space-y-6">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 100}>
              <div className="flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <b.icon className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-semibold">{b.title}</h3>
                  <p className="text-muted">{b.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <Reveal delay={150}>
        <ListingForm />
      </Reveal>
    </div>
  );
}
