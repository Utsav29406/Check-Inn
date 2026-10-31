import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { inr } from "./constants";
import { fmtDate, fmtTime } from "./time";
import type { Booking } from "./types";

// Brand colours, as in globals.css.
const C = {
  ink: "#121614",
  muted: "#646a66",
  line: "#e2ddd1",
  cream: "#faf8f3",
  sand: "#efeadf",
  brand50: "#edf4f1",
  brand100: "#d3e4dd",
  brand: "#12493b",
  brand700: "#0b372c",
  gold300: "#e9dcb8",
  gold400: "#d6bf8a",
  gold500: "#bb9d5e",
  gold600: "#957a42",
  goldTint: "#f7f1e1",
};

// The site's fonts (Inter and Playfair Display, SIL Open Font License), embedded so the ₹ sign and branding render everywhere.
const FONT_DIR = path.join(process.cwd(), "assets/fonts");
const F = {
  regular: path.join(FONT_DIR, "Inter_400Regular.ttf"),
  semibold: path.join(FONT_DIR, "Inter_600SemiBold.ttf"),
  bold: path.join(FONT_DIR, "Inter_700Bold.ttf"),
  display: path.join(FONT_DIR, "PlayfairDisplay_700Bold.ttf"),
  displayItalic: path.join(FONT_DIR, "PlayfairDisplay_700Bold_Italic.ttf"),
};

/** Playfair defaults to old-style numerals; amounts read better with lining ones. */
const LNUM: PDFKit.Mixins.TextOptions = { features: ["lnum"] };

const W = 595.28; // A4
const H = 841.89;
const M = 48;
const CW = W - 2 * M;

export const invoiceNumber = (code: string) => `INV-${code}`;

/** Postgres timestamptz text ("2026-10-29 07:45:12.34+00") to a Date; now for sample bookings. */
function issuedAt(ts?: string) {
  const d = ts ? new Date(ts.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

function payment(b: Booking) {
  const utr = b.utr ? ` · UTR ${b.utr}` : "";
  if (b.amount === 0 && b.coupon_discount > 0) {
    return { pill: "FREE WITH OFFER", tone: "brand", paid: 0, total: "Total to pay", note: "Your booking fee is covered by an offer, applied automatically." };
  }
  switch (b.payment_status) {
    case "paid":
      return { pill: "PAID", tone: "brand", paid: b.amount, total: "Total paid", note: b.utr ? `Paid by UPI${utr}.` : "Paid online." };
    case "review":
      return { pill: "PAID · VERIFYING", tone: "brand", paid: b.amount, total: "Total paid", note: `Paid by UPI${utr}. We're verifying it.` };
    case "due":
      return {
        pill: "PAY AT RESTAURANT",
        tone: "gold",
        paid: 0,
        total: "Balance due",
        note: `Please pay ${inr(b.amount)} at ${b.restaurant_name} when you arrive.`,
      };
    default:
      return { pill: "NO FEE", tone: "brand", paid: 0, total: "Total", note: "No booking fee for this reservation." };
  }
}

/** The CheckInn mark at rest, as in public/favicon.svg: a check under a see-through cloche. */
function drawMark(doc: PDFKit.PDFDocument, x: number, y: number, size: number, circle: string) {
  doc.save().translate(x, y).scale(size / 48);
  doc.circle(24, 24, 23).fill(circle);
  doc.path("M18 27.5l4 4 8-8.5").lineWidth(2.6).lineCap("round").lineJoin("round").stroke(C.gold300);
  doc.path("M11 33a13 13 0 0 1 26 0z").fillOpacity(0.35).fill(C.gold400).fillOpacity(1);
  doc.roundedRect(8, 33, 32, 3, 1.5).fill(C.gold300);
  doc.restore();
}

/** Small uppercase label, like the site's eyebrow text. */
function label(doc: PDFKit.PDFDocument, text: string, x: number, y: number, color = C.gold600) {
  doc.font("semibold").fontSize(7.5).fillColor(color).text(text.toUpperCase(), x, y, { characterSpacing: 1.2, lineBreak: false });
}

/**
 * The PDF invoice attached to the confirmation email: A4, one page, in CheckInn's emerald and champagne.
 * `link` is the guest's booking page (the QR code points there).
 */
export async function bookingInvoice(b: Booking, link: string, contact?: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    font: F.regular,
    info: {
      Title: `CheckInn invoice ${invoiceNumber(b.code)}`,
      Author: "CheckInn",
      Subject: `Table booking at ${b.restaurant_name}`,
      Creator: "CheckInn",
    },
  });
  for (const [name, file] of Object.entries(F)) doc.registerFont(name, file);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const pay = payment(b);
  const issued = issuedAt(b.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });
  const visit = fmtDate(b.booking_date, { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  doc.rect(0, 0, W, H).fill("#ffffff");
  doc.rect(0, 0, W, 6).fill(C.brand);

  // ---- Header: logo and title ----
  drawMark(doc, M, 42, 46, C.brand);
  doc.font("display").fontSize(28).fillColor(C.ink).text("Check", M + 58, 44, { lineBreak: false });
  const checkW = doc.widthOfString("Check");
  doc.font("displayItalic").fillColor(C.gold500).text("Inn", M + 58 + checkW, 44, { lineBreak: false });
  doc.font("semibold").fontSize(7.5).fillColor(C.muted).text("PREMIUM RESTAURANT BOOKING", M + 59, 80, { characterSpacing: 1.6, lineBreak: false });

  doc.font("display").fontSize(30).fillColor(C.brand).text("Invoice", M, 40, { width: CW, align: "right", lineBreak: false });
  doc.font("semibold").fontSize(9.5).fillColor(C.muted).text(invoiceNumber(b.code), M, 80, { width: CW, align: "right", characterSpacing: 0.6, lineBreak: false });

  doc.moveTo(M, 110).lineTo(W - M, 110).lineWidth(1).stroke(C.gold400);

  // ---- Meta row ----
  const metaY = 126;
  const col = CW / 4;
  const meta: [string, string][] = [
    ["Invoice date", issued],
    ["Booking code", b.code],
    ["Reservation", `${fmtDate(b.booking_date, { day: "numeric", month: "short", year: "numeric" })}, ${fmtTime(b.slot_time)}`],
  ];
  meta.forEach(([k, v], i) => {
    label(doc, k, M + i * col, metaY);
    doc.font("semibold").fontSize(10.5).fillColor(C.ink).text(v, M + i * col, metaY + 13, { width: col - 10, lineBreak: false, characterSpacing: k === "Booking code" ? 0.8 : 0 });
  });
  label(doc, "Payment", M + 3 * col, metaY);
  doc.font("bold").fontSize(7.5);
  const pillW = doc.widthOfString(pay.pill, { characterSpacing: 0.8 }) + 16;
  doc.roundedRect(M + 3 * col, metaY + 11, pillW, 17, 8.5).fill(pay.tone === "gold" ? C.goldTint : C.brand50);
  doc.fillColor(pay.tone === "gold" ? C.gold600 : C.brand).text(pay.pill, M + 3 * col + 8, metaY + 16, { characterSpacing: 0.8, lineBreak: false });

  // ---- Billed to / Reservation cards ----
  const cardY = 176;
  const cardW = (CW - 14) / 2;
  const pad = 16;
  const inner = cardW - 2 * pad;
  const leftX = M;
  const rightX = M + cardW + 14;

  const billed = [b.guest_email, b.guest_phone].filter(Boolean) as string[];
  doc.font("semibold").fontSize(11.5);
  let leftH = 22 + doc.heightOfString(b.guest_name, { width: inner }) + 4;
  doc.font("regular").fontSize(9.5);
  for (const line of billed) leftH += doc.heightOfString(line, { width: inner }) + 2;

  const where = [b.restaurant_area, b.restaurant_city].filter(Boolean).join(", ");
  doc.font("display").fontSize(14);
  let rightH = 22 + doc.heightOfString(b.restaurant_name, { width: inner, ...LNUM }) + 3;
  doc.font("regular").fontSize(9);
  rightH += doc.heightOfString(b.restaurant_address || where, { width: inner }) + 10 + 14;

  const cardH = Math.max(leftH, rightH) + pad * 2 - 6;
  for (const x of [leftX, rightX]) doc.roundedRect(x, cardY, cardW, cardH, 10).fillAndStroke(C.cream, C.line);

  label(doc, "Billed to", leftX + pad, cardY + pad);
  let y = cardY + pad + 16;
  doc.font("semibold").fontSize(11.5).fillColor(C.ink).text(b.guest_name, leftX + pad, y, { width: inner });
  y = doc.y + 4;
  doc.font("regular").fontSize(9.5).fillColor(C.muted);
  for (const line of billed) {
    doc.text(line, leftX + pad, y, { width: inner });
    y = doc.y + 2;
  }

  label(doc, "Reservation", rightX + pad, cardY + pad);
  y = cardY + pad + 16;
  doc.font("display").fontSize(14).fillColor(C.ink).text(b.restaurant_name, rightX + pad, y, { width: inner, ...LNUM });
  y = doc.y + 3;
  doc.font("regular").fontSize(9).fillColor(C.muted).text(b.restaurant_address || where, rightX + pad, y, { width: inner });
  y = doc.y + 10;
  doc.font("semibold").fontSize(9.5).fillColor(C.brand).text(`${visit} · ${fmtTime(b.slot_time)} · ${b.guests} ${b.guests === 1 ? "guest" : "guests"}`, rightX + pad, y, {
    width: inner,
    lineBreak: false,
    ellipsis: true,
  });

  // ---- Line items ----
  const tableY = cardY + cardH + 26;
  const cols = { desc: M + 16, rate: M + CW - 250, qty: M + CW - 160, amt: M + CW - 106 };
  doc.roundedRect(M, tableY, CW, 28, 8).fill(C.brand);
  doc.font("semibold").fontSize(8).fillColor(C.gold300);
  doc.text("DESCRIPTION", cols.desc, tableY + 10.5, { characterSpacing: 1, lineBreak: false });
  doc.text("RATE", cols.rate, tableY + 10.5, { width: 80, align: "right", characterSpacing: 1, lineBreak: false });
  doc.text("GUESTS", cols.qty, tableY + 10.5, { width: 50, align: "right", characterSpacing: 1, lineBreak: false });
  doc.text("AMOUNT", cols.amt, tableY + 10.5, { width: 90, align: "right", characterSpacing: 1, lineBreak: false });

  const rowY = tableY + 28 + 14;
  doc.font("semibold").fontSize(11).fillColor(C.ink).text("Table booking fee", cols.desc, rowY, { lineBreak: false });
  doc
    .font("regular")
    .fontSize(8.5)
    .fillColor(C.muted)
    .text(`${b.restaurant_name}, ${fmtDate(b.booking_date, { day: "numeric", month: "short" })} at ${fmtTime(b.slot_time)}`, cols.desc, rowY + 16, {
      width: cols.rate - cols.desc - 10,
      lineBreak: false,
      ellipsis: true,
    });
  doc.font("regular").fontSize(10.5).fillColor(C.ink);
  doc.text(inr(b.fee_per_guest), cols.rate, rowY + 6, { width: 80, align: "right", lineBreak: false });
  doc.text(String(b.guests), cols.qty, rowY + 6, { width: 50, align: "right", lineBreak: false });
  doc.font("semibold").text(inr(b.fee_per_guest * b.guests), cols.amt, rowY + 6, { width: 90, align: "right", lineBreak: false });
  const rowEnd = rowY + 42;
  doc.moveTo(M, rowEnd).lineTo(W - M, rowEnd).lineWidth(0.75).stroke(C.line);

  // ---- QR code (left) and totals (right) ----
  const blockY = rowEnd + 22;
  const totalsW = 230;
  const totalsX = W - M - totalsW;
  const sums: [string, string][] = [
    ["Subtotal", inr(b.fee_per_guest * b.guests)],
    ...(b.coupon_discount > 0 ? ([["Offer applied", `−${inr(b.coupon_discount)}`]] as [string, string][]) : []),
    ["Amount paid", inr(pay.paid)],
  ];
  sums.forEach(([k, v], i) => {
    doc.font("regular").fontSize(10).fillColor(C.muted).text(k, totalsX, blockY + i * 22, { lineBreak: false });
    doc.font("semibold").fillColor(C.ink).text(v, totalsX, blockY + i * 22, { width: totalsW, align: "right", lineBreak: false });
  });
  const boxY = blockY + sums.length * 22 + 6;
  doc.roundedRect(totalsX, boxY, totalsW, 58, 12).fill(C.brand);
  label(doc, pay.total, totalsX + 16, boxY + 13, C.gold300);
  doc.font("display").fontSize(24).fillColor("#ffffff").text(inr(pay.paid || b.amount), totalsX + 16, boxY + 24, {
    width: totalsW - 32,
    align: "right",
    lineBreak: false,
    ...LNUM,
  });

  const qr = await QRCode.toBuffer(link, { margin: 0, width: 360, errorCorrectionLevel: "M", color: { dark: C.brand, light: "#ffffff" } });
  doc.roundedRect(M, blockY - 4, 236, 112, 12).fillAndStroke(C.cream, C.line);
  doc.image(qr, M + 14, blockY + 10, { width: 84 });
  doc.font("semibold").fontSize(10).fillColor(C.ink).text("Your booking, one scan away", M + 110, blockY + 14, { width: 112 });
  doc
    .font("regular")
    .fontSize(8.5)
    .fillColor(C.muted)
    .text("Scan to view your table, get directions or cancel.", M + 110, doc.y + 4, { width: 112 });

  // ---- Payment note and member offer ----
  y = boxY + 58 + 26;
  doc.font("semibold").fontSize(9.5).fillColor(C.ink).text("Payment", M, y, { lineBreak: false });
  doc.font("regular").fillColor(C.muted).text(pay.note, M + 60, y, { width: CW - 60 });
  y = doc.y + 14;

  if (b.discount_percent > 0) {
    const offerH = 50;
    doc.roundedRect(M, y, CW, offerH, 10).fill(C.goldTint);
    doc.rect(M, y, 4, offerH).fill(C.gold500);
    doc.font("display").fontSize(13).fillColor(C.ink).text(`Flat ${b.discount_percent}% off your total bill`, M + 18, y + 10, { lineBreak: false, ...LNUM });
    doc
      .font("regular")
      .fontSize(9)
      .fillColor(C.muted)
      .text(`Show booking code ${b.code} when you pay at ${b.restaurant_name}.`, M + 18, y + 29, { width: CW - 36, lineBreak: false, ellipsis: true });
    y += offerH + 18;
  }

  // ---- Terms ----
  const terms = [
    "The table booking fee is non-refundable.",
    "This is a computer-generated invoice and does not need a signature.",
    `Questions about this booking? ${contact ? `Write to ${contact}.` : "Reply to your confirmation email."}`,
  ];
  label(doc, "Good to know", M, y);
  y += 15;
  doc.font("regular").fontSize(8.5).fillColor(C.muted);
  for (const t of terms) {
    doc.circle(M + 2.5, y + 4.5, 1.5).fill(C.gold500);
    doc.fillColor(C.muted).text(t, M + 12, y, { width: CW - 12 });
    y = doc.y + 4;
  }

  // ---- Footer ----
  const footY = H - 74;
  doc.rect(0, footY, W, 74).fill(C.brand);
  doc.rect(0, footY, W, 3).fill(C.gold400);
  drawMark(doc, M, footY + 21, 34, C.brand700);
  doc.font("display").fontSize(14).fillColor("#ffffff").text("Thank you for dining with us", M + 46, footY + 23, { lineBreak: false });
  doc.font("regular").fontSize(8.5).fillColor(C.gold300).text("Reserve the finest tables in your city.", M + 46, footY + 42, { lineBreak: false });
  const site = link.replace(/^https?:\/\//, "").split("/")[0];
  doc.font("semibold").fontSize(9).fillColor("#ffffff").text(site, M, footY + 25, { width: CW, align: "right", lineBreak: false });
  if (contact) doc.font("regular").fontSize(8.5).fillColor(C.gold300).text(contact, M, footY + 42, { width: CW, align: "right", lineBreak: false });

  doc.end();
  return done;
}
