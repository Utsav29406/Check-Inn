import { NextResponse } from "next/server";
import { getBlockedSlots, getSlotUsage } from "@/lib/restaurants";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("restaurantId"));
  const date = url.searchParams.get("date") ?? "";
  if (!Number.isInteger(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  const [usage, blocked] = await Promise.all([getSlotUsage(id, date), getBlockedSlots(id, date)]);
  return NextResponse.json({ usage, blocked });
}
