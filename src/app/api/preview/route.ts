import { NextResponse, type NextRequest } from "next/server";
import { DIWALI, PREVIEW_COOKIE } from "@/lib/festival";
import { safeNext } from "@/lib/auth";

/**
 * /api/preview?festival=diwali shows this browser the Diwali theme and offers before they're switched on for everyone;
 * /api/preview?festival=off ends the preview. ?next= picks the page to land on.
 */
export function GET(req: NextRequest) {
  const festival = req.nextUrl.searchParams.get("festival");
  const res = NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("next") ?? "/"), req.url));
  if (festival === DIWALI.key) {
    res.cookies.set(PREVIEW_COOKIE, DIWALI.key, { path: "/", maxAge: 14 * 864e2, sameSite: "lax", httpOnly: true, secure: req.nextUrl.protocol === "https:" });
  } else {
    res.cookies.delete(PREVIEW_COOKIE);
  }
  return res;
}
