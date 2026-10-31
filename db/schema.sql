-- CheckInn schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               VARCHAR(120) NOT NULL,
  email              VARCHAR(190) NOT NULL UNIQUE,
  phone              VARCHAR(20),
  password_hash      VARCHAR(100) NOT NULL,
  membership_tier    VARCHAR(10) NOT NULL DEFAULT 'none'
                     CHECK (membership_tier IN ('none', 'silver', 'gold', 'platinum')),
  membership_expires DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Google sign-in: accounts created with Google have no password.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(64) UNIQUE;

CREATE TABLE IF NOT EXISTS restaurants (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug              VARCHAR(140) NOT NULL UNIQUE,
  name              VARCHAR(140) NOT NULL,
  city              VARCHAR(60) NOT NULL,
  area              VARCHAR(100) NOT NULL,
  address           VARCHAR(255) NOT NULL,
  cuisines          VARCHAR(255) NOT NULL,
  price_for_two     INT NOT NULL,
  rating            NUMERIC(2,1) NOT NULL DEFAULT 4.0,
  reviews_count     INT NOT NULL DEFAULT 0,
  image_url         VARCHAR(500) NOT NULL,
  description       TEXT NOT NULL,
  highlights        VARCHAR(500) NOT NULL DEFAULT '',
  opening_time      TIME NOT NULL,
  closing_time      TIME NOT NULL,
  capacity_per_slot INT NOT NULL DEFAULT 30,
  discount_percent  INT NOT NULL DEFAULT 0,
  is_featured       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Optional afternoon closure, e.g. lunch until 15:00 and dinner from 19:00.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS break_start TIME;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS break_end TIME;
-- 'veg' = pure vegetarian kitchen, 'nonveg' = serves veg and non-veg.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS food_type VARCHAR(6) NOT NULL DEFAULT 'nonveg'
  CHECK (food_type IN ('veg', 'nonveg'));
-- Table booking fee in rupees, charged per guest.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS booking_fee INT NOT NULL DEFAULT 99;
ALTER TABLE restaurants ALTER COLUMN booking_fee SET DEFAULT 198;
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants (city);

CREATE TABLE IF NOT EXISTS bookings (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code              VARCHAR(12) NOT NULL UNIQUE,
  restaurant_id     BIGINT NOT NULL REFERENCES restaurants(id),
  user_id           BIGINT REFERENCES users(id),
  guest_name        VARCHAR(120) NOT NULL,
  guest_phone       VARCHAR(20) NOT NULL,
  guest_email       VARCHAR(190),
  booking_date      DATE NOT NULL,
  slot_time         TIME NOT NULL,
  guests            INT NOT NULL CHECK (guests BETWEEN 1 AND 20),
  special_request   VARCHAR(500),
  discount_percent  INT NOT NULL DEFAULT 0,
  status            VARCHAR(10) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Booking fee. With UPI QR payments on, a booking stays 'pending' (holding its seats for 15 minutes) until it's paid.
-- payment_status: 'none' (booked before fees existed), 'due' (pay at the restaurant), 'pending' (waiting for payment),
-- 'review' (paid by UPI QR, UTR not checked yet), 'paid', 'rejected' (UTR didn't match a payment; booking cancelled).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fee_per_guest INT NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount INT NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(10) NOT NULL DEFAULT 'none';
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('none', 'due', 'pending', 'review', 'paid', 'rejected'));
-- UPI reference number the guest enters after paying by QR. One payment can't confirm two bookings.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utr VARCHAR(12);
-- When the guest was emailed a reminder of the table (the morning run sends one per booking).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_utr ON bookings (utr) WHERE utr IS NOT NULL;
-- Razorpay was removed; these held test orders only.
ALTER TABLE bookings DROP COLUMN IF EXISTS razorpay_order_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS razorpay_payment_id;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'cancelled'));
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings (restaurant_id, booking_date, slot_time);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings (user_id);

CREATE TABLE IF NOT EXISTS partner_requests (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_name VARCHAR(140) NOT NULL,
  contact_name    VARCHAR(120) NOT NULL,
  phone           VARCHAR(20) NOT NULL,
  email           VARCHAR(190) NOT NULL,
  city            VARCHAR(60) NOT NULL,
  message         VARCHAR(1000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Partner requests are worked through in the admin panel.
ALTER TABLE partner_requests ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'new'
  CHECK (status IN ('new', 'contacted', 'done'));

-- Admin panel accounts: separate from customer accounts, with their own login at /admin/login.
CREATE TABLE IF NOT EXISTS admins (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Times an admin has closed for booking (one row per restaurant, date and slot).
CREATE TABLE IF NOT EXISTS slot_blocks (
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  block_date    DATE NOT NULL,
  slot_time     TIME NOT NULL,
  PRIMARY KEY (restaurant_id, block_date, slot_time)
);

-- Coupons take money off the table booking fee. Public ones are listed on /offers; personal ones (user_id set)
-- are won from scratch cards. Uses are counted from bookings that aren't cancelled, so cancelling frees the coupon.
CREATE TABLE IF NOT EXISTS coupons (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          VARCHAR(20) NOT NULL UNIQUE,
  title         VARCHAR(80) NOT NULL,
  kind          VARCHAR(7) NOT NULL CHECK (kind IN ('flat', 'percent')),
  value         INT NOT NULL CHECK (value > 0),
  max_discount  INT CHECK (max_discount > 0),
  min_guests    INT NOT NULL DEFAULT 1 CHECK (min_guests BETWEEN 1 AND 20),
  valid_until   DATE,
  max_uses      INT CHECK (max_uses > 0),
  once_per_user BOOLEAN NOT NULL DEFAULT TRUE,
  user_id       BIGINT REFERENCES users(id) ON DELETE CASCADE,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (kind = 'flat' OR value <= 100)
);
CREATE INDEX IF NOT EXISTS idx_coupons_user ON coupons (user_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coupon_id BIGINT REFERENCES coupons(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(20);
-- Rupees taken off the booking fee; amount is what's left to pay.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coupon_discount INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_bookings_coupon ON bookings (coupon_id) WHERE coupon_id IS NOT NULL;

-- One scratch card per confirmed booking by a signed-in guest. The prize is drawn when it's scratched; a card (and the
-- coupon it won) stops counting if its booking is cancelled.
CREATE TABLE IF NOT EXISTS scratch_cards (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id   BIGINT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  prize        VARCHAR(10),
  coupon_id    BIGINT REFERENCES coupons(id) ON DELETE SET NULL,
  scratched_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scratch_cards_user ON scratch_cards (user_id);

-- Festival offers (e.g. Diwali) only work, and only show, while that festival's theme is on or being previewed.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS festival VARCHAR(20);

-- Site-wide switches set from the admin panel, e.g. festival = 'on' turns the Diwali theme on for everyone.
CREATE TABLE IF NOT EXISTS site_settings (
  key   VARCHAR(40) PRIMARY KEY,
  value VARCHAR(200) NOT NULL
);
