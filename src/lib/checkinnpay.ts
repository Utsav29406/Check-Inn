/*
 * CheckInn Pay: CheckInn's own dummy payment gateway. No money moves. It behaves
 * like a real one so the whole checkout can be tried: card (with a bank OTP
 * step) or UPI (approve in your app), with test details that succeed or fail.
 *
 * These rules are shared: the window (components/CheckInnPay) checks as you type,
 * and the payMembership action decides the outcome with the same functions, so the
 * browser can never declare a payment successful on its own.
 */

export type CheckInnPayMethod = "card" | "upi";

/** The details anyone can use; also listed in the window. */
export const TEST = {
  cardSuccess: "4111 1111 1111 1111",
  cardDecline: "4000 0000 0000 0002",
  upiSuccess: "success@checkinnpay",
  upiDecline: "failure@checkinnpay",
  otp: "123456",
} as const;

/**
 * Who the QR code pays. Not a real UPI ID ("@checkinnpay" is no bank's handle), so
 * a real UPI app that scans it refuses to send money.
 */
export const QR_PAYEE = "checkinn.demo@checkinnpay";

/** UPI apps a phone can hand the payment to (names only: no logos). */
export const UPI_APPS = [
  { id: "gpay", name: "Google Pay" },
  { id: "phonepe", name: "PhonePe" },
  { id: "paytm", name: "Paytm" },
  { id: "bhim", name: "BHIM" },
  { id: "other", name: "Other UPI app" },
] as const;
export type UpiAppId = (typeof UPI_APPS)[number]["id"];

/** The standard UPI payment link a QR code carries (NPCI's upi://pay format). */
export function upiPayLink(ref: string, amount: number, note: string): string {
  const q = new URLSearchParams({
    pa: QR_PAYEE,
    pn: "CheckInn (demo)",
    am: amount.toFixed(2),
    cu: "INR",
    tn: note,
    tr: ref,
  });
  // Spaces as %20 and the payee's "@" left as it is, as UPI apps expect.
  return `upi://pay?${q.toString().replace(/\+/g, "%20").replace(/%40/g, "@")}`;
}

export function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Luhn checksum, as every real card number passes. */
export function luhnValid(number: string): boolean {
  const d = digits(number);
  if (d.length < 12 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export type CardBrand = "Visa" | "Mastercard" | "RuPay" | "Amex" | null;
export function cardBrand(number: string): CardBrand {
  const d = digits(number);
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^(60|65|81|82|508)/.test(d)) return "RuPay";
  if (/^3[47]/.test(d)) return "Amex";
  return null;
}

/** "4111 1111 1111 1111" as it is typed. */
export function formatCardNumber(value: string): string {
  return digits(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** "MM / YY" as it is typed. */
export function formatExpiry(value: string): string {
  const d = digits(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}

/** Valid month, and not before this month. */
export function expiryValid(value: string, now: Date = new Date()): boolean {
  const d = digits(value);
  if (d.length !== 4) return false;
  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) return false;
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

export function cvvValid(value: string, brand: CardBrand): boolean {
  return new RegExp(`^\\d{${brand === "Amex" ? 4 : 3}}$`).test(value);
}

export function upiValid(vpa: string): boolean {
  return /^[a-z0-9.\-_]{2,64}@[a-z]{2,32}$/i.test(vpa.trim());
}

/** What is wrong with the card details, or null. */
export function cardProblem(card: { number: string; expiry: string; cvv: string }): string | null {
  if (!luhnValid(card.number)) return "Check the card number.";
  if (!expiryValid(card.expiry)) return "Check the expiry date.";
  if (!cvvValid(card.cvv, cardBrand(card.number))) return "Check the CVV.";
  return null;
}

/** The bank's answer, once the details are valid. */
export function cardDeclined(number: string): boolean {
  return digits(number) === digits(TEST.cardDecline);
}

export function upiDeclined(vpa: string): boolean {
  return vpa.trim().toLowerCase() === TEST.upiDecline;
}
