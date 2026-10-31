import { requireAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { fmtDate } from "@/lib/time";
import { ActionForm, Field, field } from "@/components/admin/ActionForm";
import { Card, PageHeader, smallBtn } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { addAdmin, removeAdmin, setPartnerStatus, updateAdmin } from "../../actions";

export const dynamic = "force-dynamic";

const PARTNER_STATUS = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["done", "Done"],
] as const;

export default async function AdminUsers() {
  const me = await requireAdmin();
  const [users, partners, admins] = await Promise.all([
    query<{ id: number; name: string; email: string; phone: string | null; google: boolean; membership_tier: string; membership_expires: string | null; created_at: string; bookings: number }>(
      `SELECT u.id, u.name, u.email, u.phone, (u.google_id IS NOT NULL) AS google, u.membership_tier, u.membership_expires, u.created_at::date::text AS created_at,
              (SELECT count(*) FROM bookings b WHERE b.user_id = u.id AND b.status = 'confirmed')::int AS bookings
       FROM users u ORDER BY u.created_at DESC LIMIT 500`,
    ),
    query<{ id: number; restaurant_name: string; contact_name: string; phone: string; email: string; city: string; message: string | null; status: string; created_at: string }>(
      "SELECT *, created_at::date::text AS created_at FROM partner_requests ORDER BY (status = 'new') DESC, id DESC LIMIT 200",
    ),
    query<{ id: number; name: string; email: string; created_at: string }>("SELECT id, name, email, created_at::date::text AS created_at FROM admins ORDER BY id"),
  ]);

  return (
    <>
      <PageHeader title="Users & partners" subtitle={`${users.length} users · ${partners.filter((p) => p.status === "new").length} new partner requests`} />

      <div className="grid gap-6">
        <Card title={`Users (${users.length})`}>
          <ul className="divide-y divide-black/5">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <b>{u.name}</b> <span className="text-muted">· {u.email}{u.phone && ` · ${u.phone}`}</span>
                  <span className="block text-xs text-muted">
                    Joined {fmtDate(u.created_at)} · {u.google ? "Google sign-in" : "Email & password"} · {u.bookings} confirmed bookings
                  </span>
                </span>
                {u.membership_tier !== "none" && (
                  <span className="rounded-full bg-gold-300/60 px-2.5 py-0.5 text-[11px] font-bold capitalize text-gold-600">
                    {u.membership_tier}{u.membership_expires && ` · until ${fmtDate(u.membership_expires)}`}
                  </span>
                )}
              </li>
            ))}
            {!users.length && <li className="px-5 py-8 text-center text-sm text-muted">No users yet.</li>}
          </ul>
        </Card>

        <div id="partners">
          <Card title={`Partner requests (${partners.length})`}>
            <ul className="divide-y divide-black/5">
              {partners.map((p) => (
                <li key={p.id} className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <p>
                      <b>{p.restaurant_name}</b>, {p.city} <span className="text-xs text-muted">· {fmtDate(p.created_at)}</span>
                    </p>
                    <p className="text-muted">
                      {p.contact_name} · <a href={`tel:${p.phone}`} className="text-brand-600">{p.phone}</a> ·{" "}
                      <a href={`mailto:${p.email}`} className="text-brand-600">{p.email}</a>
                    </p>
                    {p.message && <p className="mt-1 text-xs italic text-muted">“{p.message}”</p>}
                  </div>
                  <form action={setPartnerStatus} className="flex gap-1 rounded-xl bg-sand p-1">
                    <input type="hidden" name="id" value={p.id} />
                    {PARTNER_STATUS.map(([value, label]) => (
                      <button
                        key={value}
                        name="status"
                        value={value}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${p.status === value ? "bg-white text-ink shadow-sm" : "text-muted"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </form>
                </li>
              ))}
              {!partners.length && <li className="px-5 py-8 text-center text-sm text-muted">No partner requests yet.</li>}
            </ul>
          </Card>
        </div>

        <Card title="Admins">
          <ul className="divide-y divide-black/5">
            {admins.map((a) => (
              <li key={a.id} className="px-5 py-3 text-sm">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span>
                      <b>{a.name}</b> <span className="text-muted">· {a.email} · since {fmtDate(a.created_at)}</span>
                      {a.id === me.id && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-600">You</span>}
                    </span>
                    <span className={`${smallBtn} border border-black/10 group-open:bg-sand`}>Edit</span>
                  </summary>
                  <div className="mt-4 rounded-xl bg-sand/60 p-4">
                    <ActionForm action={updateAdmin} submit="Save" className="grid gap-3 sm:grid-cols-3 [&>button]:sm:col-span-3 [&>button]:sm:justify-self-start [&>p]:sm:col-span-3">
                      <input type="hidden" name="id" value={a.id} />
                      <Field label="Name"><input name="name" defaultValue={a.name} required className={field} /></Field>
                      <Field label="Email"><input name="email" type="email" defaultValue={a.email} required className={field} /></Field>
                      <Field label="New password" hint="Leave empty to keep the current one">
                        <input name="password" type="password" minLength={10} autoComplete="new-password" className={field} />
                      </Field>
                    </ActionForm>
                    {a.id !== me.id && (
                      <form action={removeAdmin} className="mt-3">
                        <input type="hidden" name="id" value={a.id} />
                        <ConfirmButton message={`Remove ${a.name} as admin?`} className={`${smallBtn} border border-red-200 text-red-700`}>Remove admin</ConfirmButton>
                      </form>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <div className="border-t border-black/5 p-5">
            <p className="mb-3 text-sm font-semibold">Add an admin</p>
            <ActionForm action={addAdmin} submit="Add admin" className="grid gap-3 sm:grid-cols-3 [&>button]:sm:col-span-3 [&>button]:sm:justify-self-start [&>p]:sm:col-span-3">
              <Field label="Name"><input name="name" required className={field} /></Field>
              <Field label="Email"><input name="email" type="email" required className={field} /></Field>
              <Field label="Password" hint="At least 10 characters"><input name="password" type="password" minLength={10} autoComplete="new-password" required className={field} /></Field>
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}
