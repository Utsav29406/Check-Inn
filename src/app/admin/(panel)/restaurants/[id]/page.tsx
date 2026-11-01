import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { CITIES } from "@/lib/constants";
import { ActionForm, Field, field } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/ui";
import { LocationField } from "@/components/LocationField";
import { PhotoPicker } from "@/components/PhotoPicker";
import { saveRestaurant } from "../../../actions";
import type { Restaurant } from "@/lib/types";

export const dynamic = "force-dynamic";

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

/** /admin/restaurants/new adds one; /admin/restaurants/<id> edits it. */
export default async function EditRestaurant({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  let r: Partial<Restaurant> = { city: "Ahmedabad", food_type: "nonveg", booking_fee: 198, capacity_per_slot: 30, rating: 4.3, reviews_count: 0, discount_percent: 0 };
  if (id !== "new") {
    const [row] = await query<Restaurant>("SELECT * FROM restaurants WHERE id = $1", [Number(id) || 0]);
    if (!row) notFound();
    r = row;
  }

  return (
    <>
      <Link href="/admin/restaurants" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Restaurants
      </Link>
      <PageHeader title={r.name ?? "Add restaurant"} subtitle={r.slug ? `/restaurants/${r.slug}` : "It appears on the site as soon as you save."} />

      <ActionForm action={saveRestaurant} submit={r.id ? "Save changes" : "Add restaurant"} className="grid max-w-4xl gap-6 rounded-2xl bg-white p-5 ring-1 ring-black/5 md:p-8">
        {r.id && <input type="hidden" name="id" value={r.id} />}
        <Section title="Basics">
          <Field label="Name"><input name="name" defaultValue={r.name} required className={field} /></Field>
          <Field label="Cuisines" hint="Comma separated, e.g. Gujarati, Thali"><input name="cuisines" defaultValue={r.cuisines} required className={field} /></Field>
          <Field label="City">
            <select name="city" defaultValue={r.city} className={field}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Area"><input name="area" defaultValue={r.area} required className={field} /></Field>
          <div className="sm:col-span-2"><Field label="Full address"><input name="address" defaultValue={r.address} required className={field} /></Field></div>
          <Field label="Food">
            <select name="food_type" defaultValue={r.food_type} className={field}>
              <option value="veg">Pure veg</option>
              <option value="nonveg">Non-veg (serves both)</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Location on the map" hint="Google Maps link or coordinates. Shown as a map on the restaurant page and used for directions.">
              <LocationField name="location" defaultValue={r.latitude != null ? `${r.latitude}, ${r.longitude}` : ""} />
            </Field>
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Field label="Photo" hint="Upload one, or paste an https:// link below. A new upload replaces the current photo.">
              <PhotoPicker name="photo" current={r.image_url} />
            </Field>
            <Field label="…or photo link"><input name="image_url" type="text" defaultValue={r.image_url} placeholder="https://" className={field} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description"><textarea name="description" defaultValue={r.description} rows={3} required className={field} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Highlights" hint="Comma separated, e.g. Rooftop, Live Music, Pure Veg"><input name="highlights" defaultValue={r.highlights} className={field} /></Field>
          </div>
        </Section>

        <Section title="Prices & offer">
          <Field label="Price for two (₹)"><input name="price_for_two" type="number" min={100} defaultValue={r.price_for_two} required className={field} /></Field>
          <Field label="Booking fee per guest (₹)" hint="0 for free booking"><input name="booking_fee" type="number" min={0} defaultValue={r.booking_fee} required className={field} /></Field>
          <Field label="Offer (% off the bill)" hint="0 for no offer"><input name="discount_percent" type="number" min={0} max={90} defaultValue={r.discount_percent} required className={field} /></Field>
          <label className="flex items-center gap-3 self-end rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold">
            <input type="checkbox" name="is_featured" defaultChecked={r.is_featured} className="h-4 w-4 accent-brand-600" /> Featured on the home page
          </label>
        </Section>

        <Section title="Hours & seats">
          <Field label="Opens"><input name="opening_time" type="time" defaultValue={hhmm(r.opening_time)} required className={field} /></Field>
          <Field label="Closes"><input name="closing_time" type="time" defaultValue={hhmm(r.closing_time)} required className={field} /></Field>
          <Field label="Afternoon break from" hint="Optional, e.g. 15:00"><input name="break_start" type="time" defaultValue={hhmm(r.break_start)} className={field} /></Field>
          <Field label="Break until" hint="Optional, e.g. 19:00"><input name="break_end" type="time" defaultValue={hhmm(r.break_end)} className={field} /></Field>
          <Field label="Seats per time slot" hint="Booking stops when a slot has this many guests"><input name="capacity_per_slot" type="number" min={1} defaultValue={r.capacity_per_slot} required className={field} /></Field>
        </Section>

        <Section title="Rating shown on the site">
          <Field label="Rating (1–5)"><input name="rating" type="number" step="0.1" min={1} max={5} defaultValue={r.rating} required className={field} /></Field>
          <Field label="Number of reviews"><input name="reviews_count" type="number" min={0} defaultValue={r.reviews_count} required className={field} /></Field>
        </Section>
      </ActionForm>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-3 font-display text-xl font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}
