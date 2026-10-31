import { sendTodaysReminders } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron calls this once a day, between 8:30 and 9:30 AM India time (vercel.json): each table gets one reminder
 * email, on the day (breakfast tables the morning before). Vercel sends CRON_SECRET as a bearer token, so nobody else
 * can trigger it.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await sendTodaysReminders());
}
