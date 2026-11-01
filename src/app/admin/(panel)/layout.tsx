import Link from "next/link";
import { LogOut } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin";
import { paymentMode } from "@/lib/payments";
import { query } from "@/lib/db";
import { adminLogout } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [{ pending }] = await query<{ pending: number }>("SELECT count(*)::int AS pending FROM listings WHERE status = 'pending'");
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="bg-brand-900 text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 md:py-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9" />
            <span>
              <span className="block font-display text-lg font-bold leading-none">CheckInn</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-300">Admin</span>
            </span>
          </Link>
          <form action={adminLogout} className="md:hidden">
            <button className="grid h-9 w-9 place-items-center rounded-full bg-white/10" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
        <AdminNav upi={paymentMode() === "upi"} pendingListings={pending} />
        <div className="mt-auto hidden border-t border-white/10 p-4 md:block">
          <p className="truncate text-sm font-semibold">{admin.name}</p>
          <p className="truncate text-xs text-white/60">{admin.email}</p>
          <div className="mt-3 flex gap-2 text-xs">
            <Link href="/" className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15">View site</Link>
            <form action={adminLogout}>
              <button className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/15">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10">{children}</main>
    </div>
  );
}
