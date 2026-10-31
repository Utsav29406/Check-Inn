import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { createSession, safeNext } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendSignInAlert } from "@/lib/email";
import { requestSummary } from "@/lib/limits";
import { OAUTH_COOKIE, callbackUrl, exchangeCode, findOrCreateGoogleUser, googleConfig, requestOrigin } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Google redirects back here with ?code&state. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = requestOrigin(req);
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });

  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
  const config = googleConfig();
  if (!config) return fail("google");
  if (url.searchParams.get("error")) return fail("google_cancelled");

  let stored: { state: string; codeVerifier: string; next: string } | null = null;
  try {
    stored = raw ? JSON.parse(raw) : null;
  } catch {}
  const code = url.searchParams.get("code");
  if (!stored || !code || url.searchParams.get("state") !== stored.state) return fail("google");

  try {
    const profile = await exchangeCode({
      ...config,
      code,
      codeVerifier: stored.codeVerifier,
      redirectUri: callbackUrl(origin),
    });
    const userId = await findOrCreateGoogleUser(profile);
    await createSession(userId);
    // Sign-in alert to the account's email (the user's own address, which may differ from the Google one if linked).
    const [u] = await query<{ name: string; email: string }>("SELECT name, email FROM users WHERE id = $1", [userId]);
    const where = await requestSummary();
    if (u) after(() => sendSignInAlert({ to: u.email, name: u.name, method: "Continue with Google", ...where }));
  } catch (e) {
    console.error("Google sign-in failed:", e);
    return fail("google");
  }
  return NextResponse.redirect(new URL(safeNext(stored.next), origin));
}
