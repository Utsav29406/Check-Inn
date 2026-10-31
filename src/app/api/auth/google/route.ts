import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/auth";
import { OAUTH_COOKIE, authorizationUrl, callbackUrl, googleConfig, requestOrigin } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Starts Google sign-in: remembers state + PKCE verifier in a short-lived cookie and redirects to Google. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = requestOrigin(req);
  const config = googleConfig();
  if (!config) return NextResponse.redirect(new URL("/login?error=google", origin));

  const state = randomBytes(16).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const next = safeNext(url.searchParams.get("next"));

  const res = NextResponse.redirect(
    authorizationUrl({ clientId: config.clientId, redirectUri: callbackUrl(origin), state, codeChallenge }),
  );
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, codeVerifier, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
