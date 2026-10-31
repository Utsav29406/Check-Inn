import { Check, Crown, PartyPopper } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PLANS, inr } from "@/lib/constants";
import { fmtDate } from "@/lib/time";
import { joinMembership } from "@/app/actions";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";
export const metadata = { title: "CheckInn Club | Membership" };

const FAQ = [
  ["How does the extra discount work?", "Your club discount stacks on top of the restaurant's own CheckInn offer and is applied automatically to every booking you make while signed in."],
  ["Can I upgrade my plan?", "Yes — choose a higher tier at any time. Your new benefits start immediately and your one-year term restarts from the upgrade date."],
  ["Is there a limit on bookings?", "No. Book as often as you like; the club discount applies to every reservation."],
];

export default async function MembershipPage({ searchParams }: { searchParams: Promise<{ joined?: string }> }) {
  const [user, { joined }] = await Promise.all([getCurrentUser(), searchParams]);
  const current = user?.membership_tier ?? "none";
  const currentIdx = PLANS.findIndex((p) => p.tier === current);

  return (
    <>
      <section className="relative overflow-hidden bg-brand-900 pb-40 pt-20 text-center text-white">
        <div className="pointer-events-none absolute left-1/2 top-0 h-125 w-125 -translate-x-1/2 rounded-full bg-gold-500/15 blur-3xl" />
        <Reveal className="relative mx-auto max-w-2xl px-4">
          <Crown className="mx-auto h-12 w-12 text-gold-400 animate-float" />
          <h1 className="mt-6 font-display text-4xl font-bold sm:text-5xl">
            The <span className="text-gradient-gold italic">CheckInn Club</span>
          </h1>
          <p className="mt-4 text-lg text-white/70">
            One membership. Extra savings at every partner restaurant, priority tables and invitations to members-only experiences.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto -mt-28 max-w-6xl px-4 sm:px-6">
        {joined && user && current !== "none" && (
          <div className="relative mb-8 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gold-400">
            <PartyPopper className="h-8 w-8 shrink-0 text-gold-500" />
            <p>
              <b>Welcome to the club!</b> Your {PLANS[currentIdx].name} membership is active until{" "}
              {fmtDate(user.membership_expires!, { day: "numeric", month: "long", year: "numeric" })}.
            </p>
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((p, i) => {
            const isCurrent = p.tier === current;
            return (
              <Reveal key={p.tier} delay={i * 120}>
                <div className={`relative flex h-full flex-col rounded-3xl bg-white p-8 shadow-xl ${p.popular ? "ring-2 ring-gold-400 md:-translate-y-4" : "ring-1 ring-black/5"}`}>
                  {p.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold-400 px-4 py-1 text-xs font-bold uppercase tracking-wider text-ink">
                      Most popular
                    </span>
                  )}
                  <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">{p.name}</p>
                  <p className="mt-4 font-display text-5xl font-bold">{inr(p.price)}</p>
                  <p className="text-muted">per year</p>
                  <ul className="mt-8 flex-1 space-y-3">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex gap-3">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" /> {perk}
                      </li>
                    ))}
                  </ul>
                  <form action={joinMembership} className="mt-8">
                    <input type="hidden" name="tier" value={p.tier} />
                    <button
                      disabled={isCurrent || i < currentIdx}
                      className={`w-full rounded-xl py-3 font-semibold transition disabled:cursor-default disabled:opacity-60 ${p.popular ? "bg-gold-400 text-ink hover:bg-gold-300" : "bg-brand-600 text-white hover:bg-brand-700"}`}
                    >
                      {isCurrent ? "Your current plan" : i < currentIdx ? "Included in your plan" : current !== "none" ? `Upgrade to ${p.name}` : `Join ${p.name}`}
                    </button>
                  </form>
                </div>
              </Reveal>
            );
          })}
        </div>
        {!user && <p className="mt-6 text-center text-sm text-muted">You&apos;ll be asked to sign in before joining.</p>}
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-center font-display text-3xl font-bold">Frequently asked questions</h2>
        <div className="mt-10 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-2xl bg-white p-6 ring-1 ring-black/5 open:shadow-md">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                {q}
                <span className="text-2xl text-brand-600 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
