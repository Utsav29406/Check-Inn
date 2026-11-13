import { NextResponse } from "next/server";
import { getBlockedSlots, getSlotUsage } from "@/lib/restaurants";
import { addDays } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("restaurantId") ?? "";
  const id = Number(raw);
  const date = url.searchParams.get("date") ?? "";
  // A real date round-trips through addDays unchanged, so impossible ones like 2026-02-31 are refused too.
  const realDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && addDays(date, 0) === date;
  if (!/^\d{1,9}$/.test(raw) || id < 1 || !realDate) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  const [usage, blocked] = await Promise.all([getSlotUsage(id, date), getBlockedSlots(id, date)]);
  return NextResponse.json({ usage, blocked });
}
