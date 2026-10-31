import "server-only";

/** The booking fee is paid by our own UPI QR when UPI_ID is set ("upi"); otherwise at the restaurant ("venue"). */
export const paymentMode = (): "upi" | "venue" => (process.env.UPI_ID ? "upi" : "venue");

/** UPI payment link for an exact amount. Every UPI app opens it, and the QR code is this same link. */
export function upiLink(rupees: number, note: string) {
  // The UPI ID goes in unencoded: some apps don't decode "%40" back to "@".
  const name = encodeURIComponent(process.env.UPI_NAME || "CheckInn");
  return `upi://pay?pa=${process.env.UPI_ID}&pn=${name}&am=${rupees.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
}
