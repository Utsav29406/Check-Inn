import type { Booking } from "@/lib/types";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl bg-white p-5 ring-1 ring-black/5";
  return href ? <a href={href} className={`${cls} transition hover:ring-brand-500`}>{body}</a> : <div className={cls}>{body}</div>;
}

export function Card({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5">
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const PAY: Record<Booking["payment_status"], [string, string]> = {
  none: ["No fee", "bg-black/5 text-muted"],
  due: ["Fee due", "bg-gold-300/50 text-gold-600"],
  pending: ["Paying", "bg-black/5 text-muted"],
  review: ["UPI to check", "bg-blue-50 text-blue-700"],
  paid: ["Fee paid", "bg-emerald-50 text-emerald-700"],
  rejected: ["UPI rejected", "bg-red-50 text-red-700"],
};

export function PaymentBadge({ status }: { status: Booking["payment_status"] }) {
  const [label, cls] = PAY[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{label}</span>;
}

export function StatusBadge({ status }: { status: Booking["status"] }) {
  const cls = status === "confirmed" ? "bg-emerald-50 text-emerald-700" : status === "cancelled" ? "bg-black/5 text-muted" : "bg-blue-50 text-blue-700";
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${cls}`}>{status}</span>;
}

export const smallBtn = "rounded-lg px-3 py-1.5 text-xs font-semibold";
