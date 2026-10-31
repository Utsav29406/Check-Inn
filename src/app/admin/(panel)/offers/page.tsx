import { requireAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { couponBenefit, inr } from "@/lib/constants";
import { DIWALI_PRIZES, SCRATCH_PRIZES, SCRATCH_VALID_DAYS } from "@/lib/offers";
import { DIWALI, getFestivalSwitch } from "@/lib/festival";
import { siteUrl } from "@/lib/email";
import { fmtDate, nowInIndia } from "@/lib/time";
import { ActionForm, Field, field } from "@/components/admin/ActionForm";
import { Card, PageHeader, StatCard, smallBtn } from "@/components/admin/ui";
import type { Coupon } from "@/lib/types";
import { addCoupon, setCouponActive, setFestival } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminOffers() {
  await requireAdmin();
  const today = nowInIndia().date;
  const [festivalSwitch, coupons, [stats], wins] = await Promise.all([
    getFestivalSwitch(),
    query<Coupon & { uses: number; saved: number }>(
      `SELECT c.*, count(b.id)::int AS uses, COALESCE(sum(b.coupon_discount), 0)::int AS saved
       FROM coupons c LEFT JOIN bookings b ON b.coupon_id = c.id AND b.status <> 'cancelled'
       WHERE c.user_id IS NULL GROUP BY c.id ORDER BY c.active DESC, c.created_at DESC`,
    ),
    query<{ cards: number; scratched: number; won: number; redeemed: number; saved: number }>(
      `SELECT (SELECT count(*) FROM scratch_cards)::int AS cards,
              (SELECT count(*) FROM scratch_cards WHERE scratched_at IS NOT NULL)::int AS scratched,
              (SELECT count(*) FROM scratch_cards WHERE coupon_id IS NOT NULL)::int AS won,
              (SELECT count(*) FROM bookings b JOIN scratch_cards s ON s.coupon_id = b.coupon_id WHERE b.status <> 'cancelled')::int AS redeemed,
              (SELECT COALESCE(sum(coupon_discount), 0) FROM bookings WHERE status <> 'cancelled')::int AS saved`,
    ),
    query<{ name: string; code: string; title: string; scratched_at: string; used: boolean }>(
      `SELECT u.name, c.code, c.title, s.scratched_at::date::text AS scratched_at,
              EXISTS (SELECT 1 FROM bookings b WHERE b.coupon_id = c.id AND b.status <> 'cancelled') AS used
       FROM scratch_cards s JOIN users u ON u.id = s.user_id JOIN coupons c ON c.id = s.coupon_id
       ORDER BY s.scratched_at DESC LIMIT 20`,
    ),
  ]);
  const odds = (prizes: typeof SCRATCH_PRIZES) => {
    const total = Object.values(prizes).reduce((n, p) => n + p.weight, 0);
    return Object.entries(prizes).map(([key, p]) => ({ key, title: p.coupon?.title ?? "Better luck next time", benefit: p.coupon && couponBenefit(p.coupon), pct: Math.round((p.weight / total) * 100) }));
  };
  const diwaliOn = festivalSwitch === "on" && today <= DIWALI.ends;
  const previewLink = `${siteUrl()}/api/preview?festival=diwali`;

  return (
    <>
      <PageHeader title="Offers" subtitle="Coupon codes and scratch cards. Coupons take money off the table booking fee." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Scratch cards" value={stats.cards} hint={`${stats.scratched} scratched`} />
        <StatCard label="Cards that won" value={stats.won} hint={`${stats.redeemed} used on a booking`} />
        <StatCard label="Coupon codes live" value={coupons.filter((c) => c.active).length} hint={`${coupons.length} in total`} />
        <StatCard label="Saved by guests" value={inr(stats.saved)} hint="Booking fees taken off" />
      </div>

      <div className="mt-6 grid gap-6">
        <section className="overflow-hidden rounded-2xl bg-[radial-gradient(120%_120%_at_100%_0%,#1d6650_0%,#061f19_60%)] p-6 text-white ring-1 ring-black/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-300">Diwali theme · {fmtDate(DIWALI.day, { weekday: "short", day: "numeric", month: "short" })}</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{diwaliOn ? "On for everyone" : today > DIWALI.ends ? "Diwali is over" : "Off: preview only"}</h2>
              <p className="mt-1 text-sm text-white/70">
                {diwaliOn
                  ? `Every visitor sees the Diwali look, the Diwali offers and Diwali scratch-card prizes until ${fmtDate(DIWALI.ends, { day: "numeric", month: "long" })}, then it switches off by itself.`
                  : "Only browsers that open the preview link see the Diwali look and offers. Open it on your phone and laptop, then switch it on."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/api/preview?festival=diwali" target="_blank" className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">
                Preview in this browser
              </a>
              {today <= DIWALI.ends && (
                <form action={setFestival}>
                  <input type="hidden" name="mode" value={diwaliOn ? "off" : "on"} />
                  <button className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${diwaliOn ? "bg-white/15 hover:bg-white/25" : "bg-gold-400 text-brand-900 hover:bg-gold-300"}`}>
                    {diwaliOn ? "Switch off" : "Switch on for everyone"}
                  </button>
                </form>
              )}
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-black/25 px-3 py-2 font-mono text-xs break-all text-gold-300">Preview link: {previewLink}</p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-5">
            {odds(DIWALI_PRIZES).map((p) => (
              <li key={p.key} className="rounded-lg bg-white/5 px-3 py-2">
                <b className="text-gold-300">{p.pct}%</b> <span className="text-white/80">{p.title}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-white/50">Diwali scratch-card prizes, used instead of the usual ones while the theme is on.</p>
        </section>

        <Card title="Coupon codes">
          <ul className="divide-y divide-black/5">
            {coupons.map((c) => {
              const expired = Boolean(c.valid_until && c.valid_until < today);
              const usedUp = Boolean(c.max_uses && c.uses >= c.max_uses);
              return (
                <li key={c.id} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 text-sm ${c.active ? "" : "opacity-60"}`}>
                  <span className="min-w-0">
                    <span className="font-mono font-bold tracking-wider text-brand-600">{c.code}</span> <b className="ml-1">{c.title}</b>
                    <span className="block text-xs text-muted">
                      {couponBenefit(c)}
                      {c.min_guests > 1 && ` · ${c.min_guests}+ guests`}
                      {c.once_per_user ? " · once per guest" : ""}
                      {c.valid_until && ` · until ${fmtDate(c.valid_until)}`}
                      {` · used ${c.uses}${c.max_uses ? ` of ${c.max_uses}` : ""} · ${inr(c.saved)} off`}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {expired && <Badge tone="muted">Expired</Badge>}
                    {usedUp && <Badge tone="muted">Used up</Badge>}
                    {c.festival && <Badge tone="festive">Diwali only</Badge>}
                    <Badge tone={c.is_public ? "brand" : "muted"}>{c.is_public ? "On offers page" : "Hidden code"}</Badge>
                    <form action={setCouponActive}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="active" value={String(!c.active)} />
                      <button className={`${smallBtn} border border-black/10 ${c.active ? "text-red-700" : "text-brand-600"}`}>{c.active ? "Switch off" : "Switch on"}</button>
                    </form>
                  </span>
                </li>
              );
            })}
            {!coupons.length && <li className="px-5 py-8 text-center text-sm text-muted">No coupon codes yet.</li>}
          </ul>
          <div className="border-t border-black/5 p-5">
            <p className="mb-3 text-sm font-semibold">Create a coupon</p>
            <ActionForm action={addCoupon} submit="Create coupon" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>button]:sm:col-span-2 [&>button]:sm:justify-self-start [&>p]:sm:col-span-2 [&>p]:lg:col-span-4">
              <Field label="Code" hint="Letters and numbers, e.g. DIWALI100">
                <input name="code" required maxLength={20} className={`${field} font-mono uppercase`} />
              </Field>
              <Field label="Title" hint="Shown to guests">
                <input name="title" required maxLength={80} placeholder="₹100 off this Diwali" className={field} />
              </Field>
              <Field label="Discount">
                <span className="flex gap-2">
                  <select name="kind" className={`${field} w-24`} defaultValue="flat">
                    <option value="flat">₹ off</option>
                    <option value="percent">% off</option>
                  </select>
                  <input name="value" type="number" min={1} required placeholder="100" className={field} />
                </span>
              </Field>
              <Field label="Cap for % off" hint="Most rupees off, optional">
                <input name="max_discount" type="number" min={1} className={field} />
              </Field>
              <Field label="Minimum guests">
                <input name="min_guests" type="number" min={1} max={20} defaultValue={1} className={field} />
              </Field>
              <Field label="Last day" hint="Optional">
                <input name="valid_until" type="date" min={today} className={field} />
              </Field>
              <Field label="Total uses" hint="Optional, across all guests">
                <input name="max_uses" type="number" min={1} className={field} />
              </Field>
              <div className="flex flex-col justify-center gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="once_per_user" defaultChecked className="h-4 w-4 accent-brand-600" /> Once per guest</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="is_public" defaultChecked className="h-4 w-4 accent-brand-600" /> Show on the offers page</label>
              </div>
            </ActionForm>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Scratch card prizes (usual)">
            <ul className="divide-y divide-black/5 text-sm">
              {odds(SCRATCH_PRIZES).map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span>
                    <b>{p.title}</b>
                    {p.benefit && <span className="block text-xs text-muted">{p.benefit}</span>}
                  </span>
                  <span className="font-semibold">{p.pct}%</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-black/5 px-5 py-3 text-xs text-muted">
              Every confirmed booking by a signed-in guest earns one card. Wins last {SCRATCH_VALID_DAYS} days, work once, and are cancelled if the booking that
              earned them is cancelled.
            </p>
          </Card>

          <Card title="Recent wins">
            <ul className="divide-y divide-black/5 text-sm">
              {wins.map((w) => (
                <li key={w.code} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span className="min-w-0">
                    <b>{w.name}</b> <span className="text-muted">· {w.title}</span>
                    <span className="block font-mono text-xs text-muted">{w.code} · {fmtDate(w.scratched_at)}</span>
                  </span>
                  {w.used && <Badge tone="brand">Used</Badge>}
                </li>
              ))}
              {!wins.length && <li className="px-5 py-8 text-center text-muted">No wins yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

const BADGE = { brand: "bg-brand-50 text-brand-600", muted: "bg-black/5 text-muted", festive: "bg-gold-300/50 text-gold-600" };

function Badge({ tone, children }: { tone: keyof typeof BADGE; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${BADGE[tone]}`}>
      {children}
    </span>
  );
}
