import "server-only";
import { QR_PAYEE } from "./checkinnpay";

/**
 * How table booking fees are paid: at the restaurant, the owner's choice (Nov 2026). The online "upi" path for tables is
 * still in the code, unused.
 */
export const paymentMode = (): "upi" | "venue" => "venue";

/** Demo mode: no real UPI ID yet, so Club payments go through CheckInn Pay, the demo gateway (lib/checkinnpay). */
export const upiDemo = () => !process.env.UPI_ID;

/** The UPI ID payments go to: the owner's, or CheckInn Pay's made-up one in demo mode. */
export const upiId = () => process.env.UPI_ID || QR_PAYEE;

/** Club membership can always be paid: by CheckInn Pay in demo mode, by UPI to the owner once UPI_ID is set. */
export const upiEnabled = () => true;

/** UPI payment link for an exact amount. Every UPI app opens it, and the QR code is this same link. */
export function upiLink(rupees: number, note: string) {
  // The UPI ID goes in unencoded: some apps don't decode "%40" back to "@".
  const name = encodeURIComponent(process.env.UPI_NAME || "CheckInn");
  return `upi://pay?pa=${upiId()}&pn=${name}&am=${rupees.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
}
