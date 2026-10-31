import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession, safeNext } from "@/lib/auth";
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
    await createSession(await findOrCreateGoogleUser(profile));
  } catch (e) {
    console.error("Google sign-in failed:", e);
    return fail("google");
  }
  return NextResponse.redirect(new URL(safeNext(stored.next), origin));
}
