import { LogoMark } from "@/components/Logo";

/** The centred card used by the admin sign-in and first-admin setup pages. */
export function AdminAuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-600">CheckInn Admin</p>
            <h1 className="font-display text-2xl font-bold">{title}</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
