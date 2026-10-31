import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { query } from "./db";
import type { User } from "./types";

const COOKIE = "checkinn_session";

/**
 * Only allow redirects to local paths. Browsers read "\" as "/", so "/\evil.com" would leave the site:
 * reject backslashes, whitespace and a second leading slash.
 */
export const safeNext = (next: string | null | undefined) => (next && /^\/(?![/\\])[^\\\s]*$/.test(next) ? next : "/");
const MAX_AGE = 60 * 60 * 24 * 30;

export function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set in .env.local");
  return new TextEncoder().encode(s);
}

/** Signed token in confirmation-email links: lets whoever got the email cancel, even without an account. */
export function bookingToken(code: string) {
  return createHmac("sha256", secret()).update(`booking:${code}`).digest("base64url").slice(0, 22);
}

export function validBookingToken(code: string, token: string | null | undefined) {
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(bookingToken(code));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const [user] = await query<User>(
      "SELECT id, name, email, phone, membership_tier, membership_expires FROM users WHERE id = $1",
      [payload.uid],
    );
    return user ?? null;
  } catch {
    return null;
  }
}
