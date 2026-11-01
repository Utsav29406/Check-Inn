import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { inr } from "@/lib/constants";
import { fmtDate, fmtTime } from "@/lib/time";
import { Card, PageHeader, smallBtn } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { approveListing, rejectListing } from "../../actions";
import type { Listing } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = Listing & { slug: string | null };

const mapLink = (l: Listing) =>
  l.latitude !== null ? `https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.name} ${l.address}`)}`;

export default async function AdminListings() {
  await requireAdmin();
  const rows = await query<Row>(
    `SELECT l.*, l.created_at::date::text AS created_at, r.slug FROM listings l LEFT JOIN restaurants r ON r.id = l.restaurant_id
     ORDER BY (l.status = 'pending') DESC, l.created_at DESC LIMIT 200`,
  );
  const pending = rows.filter((l) => l.status === "pending");
  const decided = rows.filter((l) => l.status !== "pending");

  return (
    <>
      <PageHeader title="Listings" subtitle="Restaurants listed by their owners from the 'For Restaurants' page. Nothing goes on the website until you approve it." />

      <Card title={`Waiting for approval (${pending.length})`}>
        {pending.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No listings waiting. New ones appear here, and you get an email.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {pending.map((l) => (
              <li key={l.id} className="grid gap-5 p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.image_url} alt={l.name} className="aspect-4/3 w-full rounded-xl object-cover" />
                  {l.latitude !== null && (
                    <iframe
                      title={`Map of ${l.name}`}
                      src={`https://maps.google.com/maps?q=${l.latitude},${l.longitude}&z=16&output=embed`}
                      loading="lazy"
                      className="h-40 w-full rounded-xl border border-black/10"
                    />
                  )}
                </div>
                <div className="min-w-0 text-sm">
                  <p className="text-xs text-muted">Sent {fmtDate(l.created_at)}</p>
                  <h2 className="font-display text-xl font-bold">{l.name}</h2>
                  <p className="text-muted">{l.area}, {l.city}</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    <Item label="Address">
                      {l.address}{" "}
                      <a href={mapLink(l)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-brand-600">
                        <MapPin className="h-3.5 w-3.5" /> Open map
                      </a>
                    </Item>
                    <Item label="Cuisines">{l.cuisines}</Item>
                    <Item label="Price for two">{inr(l.price_for_two)} · {l.food_type === "veg" ? "Pure veg" : "Veg and non-veg"}</Item>
                    <Item label="Hours">{fmtTime(l.opening_time)} to {fmtTime(l.closing_time)}</Item>
                    <Item label="Owner">{l.owner_name}</Item>
                    <Item label="Contact">
                      <a href={`tel:${l.owner_phone}`} className="text-brand-600">{l.owner_phone}</a> · {l.owner_email}
                    </Item>
                  </dl>
                  <p className="mt-3 whitespace-pre-line rounded-xl bg-sand px-4 py-3">{l.description}</p>
                  <div className="mt-4 flex flex-wrap items-start gap-3">
                    <form action={approveListing}>
                      <input type="hidden" name="id" value={l.id} />
                      <ConfirmButton message={`Put ${l.name} on the website now?`} className={`${smallBtn} bg-brand-600 px-4 py-2 text-sm text-white`}>
                        Approve and publish
                      </ConfirmButton>
                    </form>
                    <form action={rejectListing} className="flex min-w-0 flex-1 flex-wrap gap-2">
                      <input type="hidden" name="id" value={l.id} />
                      <input name="reason" maxLength={300} placeholder="Reason, emailed to the owner (optional)" className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm" />
                      <ConfirmButton message={`Reject ${l.name}? The owner will be emailed.`} className={`${smallBtn} border border-red-200 px-4 py-2 text-sm text-red-700`}>
                        Reject
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {decided.length > 0 && (
        <div className="mt-6">
          <Card title="Recently reviewed">
            <ul className="divide-y divide-black/5 text-sm">
              {decided.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <b>{l.name}</b> <span className="text-muted">· {l.area}, {l.city} · {l.owner_name}</span>
                    {l.status === "rejected" && l.reject_reason && <span className="block text-xs text-muted">Reason: {l.reject_reason}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${l.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-black/5 text-muted"}`}>
                      {l.status === "approved" ? "Live" : "Rejected"}
                    </span>
                    {l.slug && (
                      <>
                        <Link href={`/restaurants/${l.slug}`} target="_blank" className="inline-flex items-center gap-1 font-semibold text-brand-600">
                          View <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <Link href={`/admin/restaurants/${l.restaurant_id}`} className="font-semibold text-brand-600">Edit</Link>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}
