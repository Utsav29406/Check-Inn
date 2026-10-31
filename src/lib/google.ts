import "server-only";
import { decodeJwt } from "jose";
import { query } from "./db";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const OAUTH_COOKIE = "checkinn_google_oauth";

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const callbackUrl = (origin: string) => `${origin}/api/auth/google/callback`;

/**
 * The origin the visitor actually used. `req.url` isn't reliable for this (Next.js may report localhost), and
 * Google requires the redirect URI to match a registered one exactly. On Vercel these headers are set by the proxy.
 */
export function requestOrigin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return new URL(req.url).origin;
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.slice(0, -1);
  return `${proto}://${host}`;
}

export function authorizationUrl(opts: { clientId: string; redirectUri: string; state: string; codeChallenge: string }) {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url;
}

interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

/**
 * Exchanges the authorization code for an ID token. The token comes straight from Google's token endpoint over TLS,
 * authenticated with our client secret, so its claims can be trusted without verifying the signature (OIDC Core 3.1.3.7).
 */
export async function exchangeCode(opts: {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      code: opts.code,
      code_verifier: opts.codeVerifier,
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("Google did not return an ID token");

  const claims = decodeJwt(id_token);
  const issuerOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const audienceOk = claims.aud === opts.clientId || (Array.isArray(claims.aud) && claims.aud.includes(opts.clientId));
  if (!issuerOk || !audienceOk || !claims.exp || claims.exp * 1000 < Date.now()) throw new Error("Invalid Google ID token");
  if (claims.email_verified !== true || typeof claims.email !== "string" || !claims.sub) {
    throw new Error("Google account has no verified email");
  }
  const email = claims.email.toLowerCase();
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : email.split("@")[0];
  return { sub: claims.sub, email, name };
}

/**
 * Finds the user by Google ID, else links the existing account with the same verified email, else creates one.
 * Signup never verified that email, so when linking, the old password is removed: otherwise whoever signed up
 * with someone else's address could keep signing in to the real owner's account.
 */
export async function findOrCreateGoogleUser(p: GoogleProfile): Promise<number> {
  const [existing] = await query<{ id: number }>("SELECT id FROM users WHERE google_id = $1", [p.sub]);
  if (existing) return existing.id;
  const [user] = await query<{ id: number }>(
    `INSERT INTO users (name, email, google_id) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET google_id = COALESCE(users.google_id, EXCLUDED.google_id),
       password_hash = CASE WHEN users.google_id IS NULL THEN NULL ELSE users.password_hash END
     RETURNING id`,
    [p.name.slice(0, 120), p.email, p.sub],
  );
  return user.id;
}
