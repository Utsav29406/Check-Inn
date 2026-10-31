// Creates an admin for /admin/login with a generated password (or resets that admin's password if the email exists).
// Usage: npm run admin:create -- <email> [name]
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const [email, ...nameParts] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:create -- <email> [name]");
  process.exit(1);
}
const name = nameParts.join(" ") || "CheckInn Admin";
// 16 characters from an unambiguous alphabet (no 0/O, 1/l/I).
const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = Array.from(randomBytes(16), (b) => alphabet[b % alphabet.length]).join("");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  `INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
   RETURNING (xmax = 0) AS created`,
  [name, email.toLowerCase(), await bcrypt.hash(password, 10)],
);
await client.end();
console.log(`${rows[0].created ? "Created" : "Reset password for"} admin ${email.toLowerCase()}`);
console.log(`Password: ${password}`);
console.log("Sign in at /admin/login, then change the email and password under Users & partners → Admins.");
