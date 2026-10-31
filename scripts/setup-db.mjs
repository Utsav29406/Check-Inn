// Creates the CheckInn tables on PostgreSQL and seeds sample restaurants. Safe to re-run: restaurants that already exist
// keep the changes made to them in the admin panel.
// Usage: npm run db:setup   (reads DATABASE_URL from .env.local)
import { readFile } from "node:fs/promises";
import pg from "pg";
import { restaurants } from "./seed-data.mjs";

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Copy .env.example to .env.local and add your PostgreSQL connection string.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
console.log("Connected to PostgreSQL");

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
await client.query(schema);
console.log("Schema ready");

// One-time change (October 2026): booking fees doubled. Runs before seeding, so new restaurants (which already get the new
// fees) aren't doubled, and never runs twice.
const { rowCount: doubling } = await client.query("INSERT INTO site_settings (key, value) VALUES ('fees_doubled_2026_10', 'done') ON CONFLICT (key) DO NOTHING");
if (doubling) {
  const { rowCount } = await client.query("UPDATE restaurants SET booking_fee = booking_fee * 2");
  console.log(`Doubled booking fees for ${rowCount} restaurants`);
}

// One-time switch (October 2026): Diwali theme on for everyone. Only the first run sets it, so an admin can still turn it
// off at /admin/offers without the next setup turning it back on.
const { rowCount: launching } = await client.query("INSERT INTO site_settings (key, value) VALUES ('diwali_launched_2026', 'done') ON CONFLICT (key) DO NOTHING");
if (launching) {
  await client.query("INSERT INTO site_settings (key, value) VALUES ('festival', 'on') ON CONFLICT (key) DO UPDATE SET value = 'on'");
  console.log("Diwali theme switched on for everyone");
}

const cols = [
  "slug", "name", "city", "area", "address", "cuisines", "price_for_two", "rating", "reviews_count", "image_url",
  "description", "highlights", "opening_time", "closing_time", "break_start", "break_end", "capacity_per_slot",
  "discount_percent", "is_featured", "food_type", "booking_fee",
];
const sql = `
  INSERT INTO restaurants (${cols.join(", ")})
  VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})
  ON CONFLICT (slug) DO NOTHING`;

for (const r of restaurants) {
  await client.query(sql, cols.map((c) => r[c]));
}
console.log(`Seeded ${restaurants.length} restaurants`);

// Starter offers for everyone, and Diwali 2026 specials (festival = 'diwali': live only while the Diwali theme is on or
// previewed). Admins add more, or switch these off, at /admin/offers. Existing codes are left as they are.
const offers = [
  { code: "WELCOME50", title: "₹50 off your first table", kind: "flat", value: 50, oncePerUser: true },
  { code: "GROUP25", title: "25% off for groups of 4+", kind: "percent", value: 25, maxDiscount: 200, minGuests: 4 },
  { code: "DIWALI101", title: "Diwali shagun: ₹101 off", kind: "flat", value: 101, oncePerUser: true, festival: "diwali", validUntil: "2026-11-15" },
  {
    code: "DHAMAKA", title: "Diwali dhamaka: free table booking", kind: "percent", value: 100, maxDiscount: 501, maxUses: 101,
    oncePerUser: true, festival: "diwali", validUntil: "2026-11-15",
  },
  {
    code: "PARIVAAR", title: "Family feast: half off for 6+", kind: "percent", value: 50, maxDiscount: 501, minGuests: 6,
    festival: "diwali", validUntil: "2026-11-15",
  },
];
for (const o of offers) {
  await client.query(
    `INSERT INTO coupons (code, title, kind, value, max_discount, min_guests, max_uses, once_per_user, festival, valid_until, is_public)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE) ON CONFLICT (code) DO NOTHING`,
    [o.code, o.title, o.kind, o.value, o.maxDiscount ?? null, o.minGuests ?? 1, o.maxUses ?? null, o.oncePerUser ?? false, o.festival ?? null, o.validUntil ?? null],
  );
}
console.log(`Seeded ${offers.length} offers`);
await client.end();
