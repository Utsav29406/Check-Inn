import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { query } from "./db";
import { secret } from "./auth";

/** Admin sessions are separate from customer ones: own cookie, only sent to /admin, and a 12-hour expiry. */
const COOKIE = "checkinn_admin";
const MAX_AGE = 60 * 60 * 12;

export interface Admin {
  id: number;
  name: string;
  email: string;
}

export async function createAdminSession(adminId: number) {
  const token = await new SignJWT({ aid: adminId, typ: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: MAX_AGE,
  });
}

export async function destroyAdminSession() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

export async function getCurrentAdmin(): Promise<Admin | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.typ !== "admin") return null;
    const [admin] = await query<Admin>("SELECT id, name, email FROM admins WHERE id = $1", [payload.aid]);
    return admin ?? null;
  } catch {
    return null;
  }
}

/** For admin pages and actions: the signed-in admin, or a redirect to the admin login. */
export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function adminCount() {
  const [{ n }] = await query<{ n: number }>("SELECT count(*)::int AS n FROM admins");
  return n;
}
