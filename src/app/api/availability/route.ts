import { NextResponse } from "next/server";
import { getBlockedSlots, getSlotUsage } from "@/lib/restaurants";
import { isRealDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("restaurantId") ?? "";
  const id = Number(raw);
  const date = url.searchParams.get("date") ?? "";
  if (!/^\d{1,9}$/.test(raw) || id < 1 || !isRealDate(date)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  const [usage, blocked] = await Promise.all([getSlotUsage(id, date), getBlockedSlots(id, date)]);
  return NextResponse.json({ usage, blocked });
}
