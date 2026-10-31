# CheckInn — Premium Restaurant Booking & Fine Dining Club

Next.js 16 (App Router) + Tailwind CSS v4 + **PostgreSQL** (via `pg`).

## Features
- Animated logo (cloche lid lifts, steam rises, check mark draws) + scroll-reveal animations
- Home: hero search, cuisines, featured restaurants, how it works, top offers, club, testimonials
- Restaurant search & filters (city, cuisine, pure veg / non-veg, price, keyword, sort)
- Restaurant page with live slot availability and booking (capacity-checked in a Postgres transaction)
- Table booking fee per guest (set per restaurant in `booking_fee`), paid by **UPI QR** straight to your bank when `UPI_ID` is set
- Booking confirmation with code, "My bookings", cancellation
- Accounts: email + password (bcrypt) or **Continue with Google** (OAuth 2.0 + PKCE), signed JWT session cookie
- CheckInn Club memberships (Silver / Gold / Platinum) — extra discount stacks on every booking
- "Partner with us" form for restaurants

## Setup

1. **Configure env**
   ```bash
   cp .env.example .env.local
   # DATABASE_URL = your PostgreSQL connection string
   # AUTH_SECRET  = openssl rand -base64 32
   ```
2. **Install, create tables and seed sample restaurants** (safe to re-run)
   ```bash
   npm install
   npm run db:setup
   ```
3. **Run**
   ```bash
   npm run dev        # http://localhost:3000
   # production: npm run build && npm start
   ```

## Google sign-in
The "Continue with Google" button appears only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
1. Google Cloud Console → APIs & Services → **OAuth consent screen**: app name CheckInn, scopes `email`, `profile`, `openid`; publish it.
2. **Credentials → Create credentials → OAuth client ID** → type *Web application*. Authorized redirect URIs:
   - `https://getcheckinn.vercel.app/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
3. Add the two values to Vercel (`vercel env add GOOGLE_CLIENT_ID production`, same for the secret) and to `.env.local`, then redeploy.

A Google account with the same verified email as an existing account signs into that account.

## Booking fee & UPI QR
Every restaurant has a per-guest `booking_fee` (seeded from its price for two: ₹98 / ₹198 / ₹298 / ₹398) and a
`food_type` (`veg` or `nonveg`).

How the fee is collected depends on whether `UPI_ID` is set:

- **`UPI_ID` set (UPI QR).** The booking is held as `pending` for 15 minutes, and the guest sees a
  QR for the exact amount. On phones there's also an "Open UPI app" button. The money goes straight to the bank
  account behind the UPI ID, with no gateway fees. After paying, the guest enters the 12-digit UTR. The table is
  confirmed straight away as `review`. An admin matches UTRs against the bank statement at
  `/admin/payments` and marks each one *Found it* (`paid`) or *Not received*, which rejects the payment and cancels
  the booking. A UTR can only be used once.
- **`UPI_ID` not set:** the booking is confirmed immediately, and the fee shows as payable at the restaurant.

The fee is non-refundable. Cancelling a booking doesn't trigger a refund.

## Confirmation emails
With `GMAIL_USER` and `GMAIL_APP_PASSWORD` set, guests who give an email get a confirmation from that Gmail. The
email includes the booking code, restaurant, date and time, guests, offer, fee, and links to the booking and
directions. It's sent after the response, so a failed email never blocks a booking. Gmail allows roughly 500 emails a day.
To create the app password, turn on 2-Step Verification on that Google account, then visit
https://myaccount.google.com/apppasswords.

## Admin panel
`/admin` is separate from customer accounts. It has its own `admins` table, its own login at `/admin/login`, and a
12-hour session cookie that's only sent to `/admin`.

- **First admin:** set `ADMIN_SETUP_CODE`, open `/admin/setup`, and enter the code with a name, email and password.
  This only works while there are no admins. Further admins are added under *Users & partners*.
- **Dashboard:** today's bookings and guests, the next 7 days, fees due, UPI payments to check, and new partner requests.
- **Bookings:** filter by date, restaurant, status or search, cancel a booking, or mark a fee received at the restaurant.
- **Slots:** for each restaurant and day, see seats taken per slot, and close or reopen one slot or the whole day.
  Closed slots show as "Closed" on the site and can't be booked.
- **Restaurants:** add or edit details, food type, booking fee, offer, hours, break, seats per slot and featured.
- **Users & partners:** users, partner requests (New, Contacted or Done) and admin accounts.
- **UPI payments:** verify or reject UTRs.

## Deploying to Vercel
1. Import the project (or run `vercel`). Framework preset: Next.js — no extra config needed.
2. In **Settings → Environment Variables** add `DATABASE_URL` and `AUTH_SECRET`, then redeploy.
3. The database must be reachable from the internet (Neon, Supabase, RDS…). A Postgres on `localhost` won't work from Vercel.
   For serverless, prefer the provider's **pooled** connection string (e.g. Neon's `-pooler` host).
4. Run `npm run db:setup` once locally with `DATABASE_URL` pointing at that database.

## Structure
```
db/schema.sql            Tables: users, restaurants, bookings, partner_requests
scripts/setup-db.mjs     Creates DB + tables, upserts seed data (scripts/seed-data.mjs)
src/lib/db.ts            PostgreSQL pool + transaction helper
src/lib/auth.ts          Session cookie helpers
src/app/actions.ts       Server actions: signup/login, booking, cancel, membership, partner
src/app/...              Pages
src/components/...       UI (Logo, BookingForm, RestaurantCard, …)
```

## Notes
- Membership "Join" activates instantly; it isn't charged yet (no payment is taken for it yet).
- Restaurant photos load from Unsplash; if one fails, a branded placeholder is shown.
- Restaurant data lives in Postgres — add/edit rows in the `restaurants` table or extend `scripts/seed-data.mjs` and re-run `npm run db:setup`.
