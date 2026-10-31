import { TrendingUp, Users, LayoutDashboard } from "lucide-react";
import { PartnerForm } from "@/components/PartnerForm";
import { Reveal } from "@/components/Reveal";

export const metadata = { title: "Partner with us | CheckInn" };

const BENEFITS = [
  { icon: Users, title: "Reach premium diners", text: "Get discovered by thousands of food lovers and club members in your city." },
  { icon: TrendingUp, title: "Fill quiet slots", text: "Use targeted offers to drive footfall on weekdays and off-peak hours." },
  { icon: LayoutDashboard, title: "Zero-hassle bookings", text: "Instant confirmations with capacity control — no more phone tag." },
];

export default function PartnerPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
      <div>
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">For restaurants</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">
            Grow your restaurant with <span className="italic text-brand-600">CheckInn</span>
          </h1>
          <p className="mt-4 text-lg text-muted">Join India&apos;s premium dining club and turn empty tables into loyal regulars.</p>
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
        <PartnerForm />
      </Reveal>
    </div>
  );
}
