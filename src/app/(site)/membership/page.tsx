import { Check, Clock, Crown, PartyPopper } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { PLANS, inr } from "@/lib/constants";
import { fmtDate, nowInIndia } from "@/lib/time";
import { upiEnabled } from "@/lib/payments";
import { Reveal } from "@/components/Reveal";
import { JoinPlanButton } from "@/components/JoinPlanButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "CheckInn Club | Membership" };

const btn = "w-full rounded-xl py-3 font-semibold transition";
const gold = "bg-gold-400 text-ink hover:bg-gold-300";
const green = "bg-brand-600 text-white hover:bg-brand-700";

const FAQ = [
  ["How does the extra discount work?", "Your club discount stacks on top of the restaurant's own CheckInn offer and is applied automatically to every booking you make while signed in."],
  ["How do I pay?", "By UPI: scan the QR (or open your UPI app on your phone), pay the plan's price, then enter the 12-digit UTR from your payment app. Your membership starts as soon as we confirm the payment, usually within a few hours, and we email you."],
  ["Can I upgrade my plan?", "Yes — choose a higher tier at any time and pay its price. Your new benefits start once the payment is confirmed, and your one-year term restarts from then."],
  ["Is there a limit on bookings?", "No. Book as often as you like; the club discount applies to every reservation."],
];

export default async function MembershipPage() {
  const user = await getCurrentUser();
  // An expired plan counts as no plan: it can be joined again.
  const active = Boolean(user && user.membership_tier !== "none" && user.membership_expires && user.membership_expires >= nowInIndia().date);
  const current = active ? user!.membership_tier : "none";
  const currentIdx = PLANS.findIndex((p) => p.tier === current);
  const [waiting] = user
    ? await query<{ tier: string; amount: number; utr: string }>("SELECT tier, amount, utr FROM membership_payments WHERE user_id = $1 AND status = 'review' ORDER BY id DESC LIMIT 1", [user.id])
    : [];
  const open = upiEnabled();

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
        {waiting ? (
          <div className="relative mb-8 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gold-400">
            <Clock className="h-8 w-8 shrink-0 text-gold-500" />
            <p>
              <b>Payment received, we&apos;re confirming it.</b> Your {PLANS.find((p) => p.tier === waiting.tier)?.name} membership ({inr(waiting.amount)}, UTR{" "}
              {waiting.utr}) starts as soon as it&apos;s matched with our bank, usually within a few hours. We&apos;ll email you.
            </p>
          </div>
        ) : (
          active && (
            <div className="relative mb-8 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gold-400">
              <PartyPopper className="h-8 w-8 shrink-0 text-gold-500" />
              <p>
                <b>You&apos;re in the club!</b> Your {PLANS[currentIdx].name} membership is active until{" "}
                {fmtDate(user!.membership_expires!, { day: "numeric", month: "long", year: "numeric" })}.
              </p>
            </div>
          )
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
                  <div className="mt-8">
                    {isCurrent || i < currentIdx || !open || waiting ? (
                      <button disabled className={`${btn} ${p.popular ? gold : green} cursor-default opacity-60`}>
                        {isCurrent ? "Your current plan" : i < currentIdx ? "Included in your plan" : waiting ? "Payment being confirmed" : "Joining opens soon"}
                      </button>
                    ) : (
                      <JoinPlanButton
                        tier={p.tier}
                        signedIn={Boolean(user)}
                        label={`${current !== "none" ? `Upgrade to ${p.name}` : `Join ${p.name}`} · ${inr(p.price)}`}
                        className={`${btn} ${p.popular ? gold : green} disabled:opacity-60`}
                      />
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
        {open && !user && <p className="mt-6 text-center text-sm text-muted">You&apos;ll be asked to sign in before joining. Pay by any UPI app.</p>}
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
