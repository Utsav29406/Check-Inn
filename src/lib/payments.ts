import "server-only";

/**
 * How table booking fees are paid: at the restaurant, the owner's choice (Nov 2026). The online "upi" path for tables is
 * still in the code, unused.
 */
export const paymentMode = (): "upi" | "venue" => "venue";

/** CheckInn's own UPI checkout, used for Club membership: on once UPI_ID (the owner's UPI ID) is set. */
export const upiEnabled = () => Boolean(process.env.UPI_ID);

/** UPI payment link for an exact amount. Every UPI app opens it, and the QR code is this same link. */
export function upiLink(rupees: number, note: string) {
  // The UPI ID goes in unencoded: some apps don't decode "%40" back to "@".
  const name = encodeURIComponent(process.env.UPI_NAME || "CheckInn");
  return `upi://pay?pa=${process.env.UPI_ID}&pn=${name}&am=${rupees.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
}
