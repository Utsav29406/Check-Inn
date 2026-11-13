import "server-only";

/**
 * How table booking fees are paid: at the restaurant, the owner's choice (Nov 2026). The online "upi" path for tables is
 * still in the code, unused.
 */
export const paymentMode = (): "upi" | "venue" => "venue";

/**
 * A made-up UPI ID used until the owner's real one (UPI_ID) is set, so the checkout can be tried end to end: the QR and
 * the "open UPI app" button open GPay/PhonePe with the amount filled in, and the app reports the ID as not found, so no
 * money can go anywhere. Long and odd on purpose, so it can't belong to a real person.
 */
const DEMO_UPI_ID = "checkinn.demo.nopay.7391@upi";

/** Demo mode: no real UPI ID yet, so payments use DEMO_UPI_ID and any 12-digit UTR is accepted for trying it out. */
export const upiDemo = () => !process.env.UPI_ID;

/** The UPI ID payments go to. */
export const upiId = () => process.env.UPI_ID || DEMO_UPI_ID;

/** CheckInn's own UPI checkout, used for Club membership: always on (in demo mode until UPI_ID is set). */
export const upiEnabled = () => true;

/** UPI payment link for an exact amount. Every UPI app opens it, and the QR code is this same link. */
export function upiLink(rupees: number, note: string) {
  // The UPI ID goes in unencoded: some apps don't decode "%40" back to "@".
  const name = encodeURIComponent(process.env.UPI_NAME || "CheckInn");
  return `upi://pay?pa=${upiId()}&pn=${name}&am=${rupees.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
}
