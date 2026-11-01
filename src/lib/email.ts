import "server-only";
import nodemailer from "nodemailer";
import { getBooking } from "./bookings";
import { bookingToken } from "./auth";
import { directionsUrl, feeLabel } from "./constants";
import { bookingInvoice, invoiceNumber } from "./invoice";
import { db, query } from "./db";
import { addDays, fmtDate, fmtTime, nowInIndia } from "./time";
import type { Booking } from "./types";

/** Booking emails go out from this Gmail once GMAIL_USER and GMAIL_APP_PASSWORD (a Google "App password") are set. */
export const emailEnabled = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

export const siteUrl = () => (process.env.SITE_URL || "https://getcheckinn.vercel.app").replace(/\/$/, "");

function transport() {
  const auth = { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! };
  // SMTP_HOST / SMTP_PORT send through another SMTP server instead of Gmail (the tests use a local one).
  return process.env.SMTP_HOST
    ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: false, auth })
    : nodemailer.createTransport({ service: "gmail", auth });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Emails the guest their confirmation. Never throws: a failed email mustn't break a booking. */
export async function sendBookingConfirmation(code: string) {
  if (!emailEnabled()) return;
  try {
    const b = await getBooking(code);
    if (!b?.guest_email || b.status !== "confirmed") return;
    await sendConfirmation(b, b.guest_email);
  } catch (e) {
    console.error(`Confirmation email for ${code} failed:`, e);
  }
}

const bookingLink = (code: string) => `${siteUrl()}/bookings/${code}?t=${bookingToken(code)}`;

/** The PDF invoice as an attachment, or none if it can't be made (the email still goes out). */
async function invoiceAttachment(b: Booking) {
  try {
    const content = await bookingInvoice(b, bookingLink(b.code), process.env.GMAIL_USER);
    return [{ filename: `CheckInn-${invoiceNumber(b.code)}.pdf`, content, contentType: "application/pdf" }];
  } catch (e) {
    console.error(`Invoice PDF for ${b.code} failed:`, e);
    return [];
  }
}

async function sendConfirmation(b: Booking, to: string, subjectPrefix = "") {
  const when = `${fmtDate(b.booking_date, { weekday: "long", day: "numeric", month: "long" })}, ${fmtTime(b.slot_time)}`;
  const attachments = await invoiceAttachment(b);
  await transport().sendMail({
    from: { name: "CheckInn", address: process.env.GMAIL_USER! },
    replyTo: process.env.GMAIL_USER!,
    to: { name: b.guest_name, address: to },
    subject: `${subjectPrefix}Table confirmed: ${b.restaurant_name}, ${fmtDate(b.booking_date)} at ${fmtTime(b.slot_time)}`,
    text: confirmationText(b, when, attachments.length > 0),
    html: confirmationHtml(b, when, attachments.length > 0),
    attachments,
  });
}

/** "today", "tomorrow" or the date, for a reminder. */
function dayWord(date: string) {
  const today = nowInIndia().date;
  return date === today ? "today" : date === addDays(today, 1) ? "tomorrow" : `on ${fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}`;
}

export type ReminderResult = { sent: true } | { sent: false; reason: string };

/**
 * Emails the guest a reminder of an upcoming table. Each booking gets one automatic reminder (marked in
 * reminder_sent_at, and unmarked again if the email fails); force sends another, for the admin's button.
 */
export async function sendBookingReminder(code: string, { force = false } = {}): Promise<ReminderResult> {
  if (!emailEnabled()) return { sent: false, reason: "Email isn't set up (GMAIL_USER and GMAIL_APP_PASSWORD)." };
  const b = await getBooking(code);
  if (!b || b.status !== "confirmed") return { sent: false, reason: "This booking isn't confirmed." };
  if (b.booking_date < nowInIndia().date) return { sent: false, reason: "This booking has already happened." };
  if (!b.guest_email) return { sent: false, reason: "The guest didn't give an email address." };
  const {
    rows: [claimed],
  } = await db().query("UPDATE bookings SET reminder_sent_at = now() WHERE code = $1 AND ($2 OR reminder_sent_at IS NULL) RETURNING code", [code, force]);
  if (!claimed) return { sent: false, reason: "A reminder was already sent." };
  const when = `${fmtDate(b.booking_date, { weekday: "long", day: "numeric", month: "long" })}, ${fmtTime(b.slot_time)}`;
  try {
    await transport().sendMail({
      from: { name: "CheckInn", address: process.env.GMAIL_USER! },
      replyTo: process.env.GMAIL_USER!,
      to: { name: b.guest_name, address: b.guest_email },
      subject: `Reminder: your table at ${b.restaurant_name} ${dayWord(b.booking_date)} at ${fmtTime(b.slot_time)}`,
      text: confirmationText(b, when, false, "reminder"),
      html: confirmationHtml(b, when, false, "reminder"),
    });
    return { sent: true };
  } catch (e) {
    await db().query("UPDATE bookings SET reminder_sent_at = NULL WHERE code = $1", [code]);
    console.error(`Reminder email for ${code} failed:`, e);
    return { sent: false, reason: "Gmail couldn't send it. Try again in a minute." };
  }
}

/** Tables before this time are reminded the morning before, since the morning run comes too late for them. */
const EARLY_TABLES_BEFORE = "10:30";

/**
 * The morning run (about 9 AM): one reminder to every guest who left an email and hasn't had one, for a table later
 * today, or a breakfast table tomorrow. Tables whose time has already passed are skipped, in case the run is late.
 */
export async function sendTodaysReminders() {
  const now = nowInIndia();
  const due = await query<{ code: string }>(
    `SELECT code FROM bookings
     WHERE status = 'confirmed' AND guest_email IS NOT NULL AND reminder_sent_at IS NULL
       AND ((booking_date = $1 AND slot_time > make_time($2, $3, 0)) OR (booking_date = $4 AND slot_time < $5::time))
     ORDER BY booking_date, slot_time`,
    [now.date, Math.floor(now.minutes / 60), now.minutes % 60, addDays(now.date, 1), EARLY_TABLES_BEFORE],
  );
  let sent = 0;
  for (const { code } of due) if ((await sendBookingReminder(code)).sent) sent++;
  return { due: due.length, sent };
}

/**
 * Admin check: sends a sample confirmation (made-up booking, nothing saved) so any inbox can be tried.
 * Throws with Gmail's reason if sending fails.
 */
export async function sendTestConfirmation(
  to: string,
  restaurant: Pick<Booking, "restaurant_name" | "restaurant_area" | "restaurant_city" | "restaurant_address">,
) {
  const sample = {
    ...restaurant,
    code: "TEST01",
    guest_name: "Test Guest",
    guest_email: to,
    guest_phone: "+91 98765 43210",
    fee_per_guest: 198,
    booking_date: new Date(Date.now() + 5.5 * 3600e3 + 864e5).toISOString().slice(0, 10),
    slot_time: "20:00:00",
    guests: 2,
    discount_percent: 10,
    payment_status: "due",
    amount: 396,
    utr: null,
    reminder_sent_at: null,
    coupon_code: null,
    coupon_discount: 0,
    special_request: "This is a test email from the CheckInn admin panel",
    status: "confirmed",
  } as Booking;
  await sendConfirmation(sample, to, "[Test] ");
}

function details(b: Booking, when: string): [string, string][] {
  const fee = feeLabel(b);
  return [
    ["Restaurant", `${b.restaurant_name}, ${b.restaurant_area}`],
    ["When", when],
    ["Guests", String(b.guests)],
    ...(b.discount_percent > 0 ? ([["Offer", `Flat ${b.discount_percent}% off the total bill`]] as [string, string][]) : []),
    ...(fee ? ([["Booking fee", fee]] as [string, string][]) : []),
    ["Address", b.restaurant_address],
  ];
}

type Kind = "confirmed" | "reminder";

function confirmationText(b: Booking, when: string, withInvoice: boolean, kind: Kind = "confirmed") {
  return [
    `Hi ${b.guest_name.split(" ")[0]},`,
    "",
    kind === "reminder"
      ? `A reminder of your table at ${b.restaurant_name} ${dayWord(b.booking_date)} at ${fmtTime(b.slot_time)}. We're holding it for you.`
      : `Your table at ${b.restaurant_name} is confirmed.`,
    "",
    `Booking code: ${b.code}`,
    ...details(b, when).map(([k, v]) => `${k}: ${v}`),
    ...(b.special_request ? [`Your request: ${b.special_request}`] : []),
    "",
    ...(withInvoice ? [`Your invoice (${invoiceNumber(b.code)}) is attached as a PDF.`, ""] : []),
    `View or cancel your booking: ${bookingLink(b.code)}`,
    `Directions: ${directionsUrl(b.restaurant_name, b.restaurant_address)}`,
    "",
    "See you there,",
    "CheckInn",
    "",
    "You're getting this email because a table was booked with this address on CheckInn. If that wasn't you, just reply and let us know.",
  ].join("\n");
}

/**
 * Table-based layout with inline styles, so it looks the same in Gmail, Outlook (including Outlook for Windows,
 * which ignores max-width and padding on links), Yahoo and Apple Mail, and isn't recoloured in dark mode.
 */
function confirmationHtml(b: Booking, when: string, withInvoice: boolean, kind: Kind = "confirmed") {
  const heading = kind === "reminder" ? `See you ${dayWord(b.booking_date)}` : "Your table is confirmed";
  const intro =
    kind === "reminder"
      ? `Your table at ${esc(b.restaurant_name)} is ready for you at ${fmtTime(b.slot_time)}, ${esc(b.guest_name.split(" ")[0])}.`
      : `See you at ${esc(b.restaurant_name)}, ${esc(b.guest_name.split(" ")[0])}.`;
  const font = "Inter,'Segoe UI',Helvetica,Arial,sans-serif";
  const rows = details(b, when)
    .map(
      ([k, v]) => `<tr>
        <td width="110" valign="top" style="padding:8px 0;color:#646a66;font-family:${font};font-size:13px">${k}</td>
        <td style="padding:8px 0;color:#121614;font-family:${font};font-size:15px;font-weight:600">${esc(v)}</td>
      </tr>`,
    )
    .join("");
  // Buttons are table cells with a background colour: Outlook for Windows drops padding and rounding on links.
  const button = (href: string, label: string, primary: boolean) => `<td style="padding:4px 4px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="${primary ? "#12493b" : "#ffffff"}" style="border-radius:10px;${primary ? "" : "border:1px solid #d3e4dd;"}">
          <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:12px 18px;white-space:nowrap;font-family:${font};font-size:14px;font-weight:600;text-decoration:none;color:${primary ? "#ffffff" : "#12493b"}">${label}</a>
        </td>
      </tr></table>
    </td>`;
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#efeadf;-webkit-text-size-adjust:100%">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#efeadf" style="background:#efeadf">
    <tr><td align="center" style="padding:24px 12px">
      <!--[if mso]><table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:520px;background:#ffffff;border-radius:18px">
        <tr><td bgcolor="#12493b" align="center" style="background:#12493b;padding:28px 28px 24px;border-radius:18px 18px 0 0">
          <p style="margin:0;color:#e9dcb8;font-family:${font};font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600">CheckInn</p>
          <h1 style="margin:10px 0 6px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700">${heading}</h1>
          <p style="margin:0;color:#c8d6d0;font-family:${font};font-size:15px">${intro}</p>
        </td></tr>
        <tr><td align="center" style="padding:22px 28px 6px;border-bottom:2px dashed #e2ddd1">
          <p style="margin:0;color:#646a66;font-family:${font};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600">Booking code</p>
          <p style="margin:4px 0 18px;color:#12493b;font-family:Menlo,Consolas,'Courier New',monospace;font-size:28px;font-weight:700;letter-spacing:6px">${b.code}</p>
        </td></tr>
        <tr><td style="padding:14px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
          ${
            b.special_request
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px"><tr>
                  <td bgcolor="#efeadf" style="padding:12px 14px;background:#efeadf;border-radius:10px;color:#121614;font-family:${font};font-size:14px">&ldquo;${esc(b.special_request)}&rdquo;</td>
                </tr></table>`
              : ""
          }
        </td></tr>
        <tr><td align="center" style="padding:10px 22px 26px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            ${button(bookingLink(b.code), "View booking", true)}
            ${button(directionsUrl(b.restaurant_name, b.restaurant_address), "Get directions", false)}
          </tr></table>
          ${withInvoice ? `<p style="margin:14px 0 0;color:#646a66;font-family:${font};font-size:13px">Your invoice <b style="color:#121614">${invoiceNumber(b.code)}</b> is attached as a PDF.</p>` : ""}
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p style="margin:16px 0 0;color:#646a66;font-family:${font};font-size:12px;line-height:18px">
        Need to change plans? You can cancel from your booking page.<br>
        You're getting this email because a table was booked with this address on CheckInn.
        If that wasn't you, just reply and let us know.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

/** A short branded account email: a heading, a sentence, a few label/value rows and a note. Never throws. */
async function sendNotice(n: {
  to: string;
  name: string;
  subject: string;
  heading: string;
  intro: string;
  rows: [string, string][];
  note: string;
  /** An optional button under the details. */
  link?: { href: string; label: string };
}) {
  if (!emailEnabled()) return;
  const font = "Inter,'Segoe UI',Helvetica,Arial,sans-serif";
  const rows = n.rows
    .map(
      ([k, v]) => `<tr>
        <td width="110" valign="top" style="padding:7px 0;color:#646a66;font-family:${font};font-size:13px">${esc(k)}</td>
        <td style="padding:7px 0;color:#121614;font-family:${font};font-size:15px;font-weight:600">${esc(v)}</td>
      </tr>`,
    )
    .join("");
  try {
    await transport().sendMail({
      from: { name: "CheckInn", address: process.env.GMAIL_USER! },
      replyTo: process.env.GMAIL_USER!,
      to: { name: n.name, address: n.to },
      subject: n.subject,
      text: [`Hi ${n.name.split(" ")[0]},`, "", n.intro, "", ...n.rows.map(([k, v]) => `${k}: ${v}`), "", ...(n.link ? [`${n.link.label}: ${n.link.href}`, ""] : []), n.note, "", "CheckInn"].join("\n"),
      html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(n.heading)}</title></head>
<body style="margin:0;padding:0;background:#efeadf">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#efeadf"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:520px;background:#ffffff;border-radius:18px">
      <tr><td bgcolor="#12493b" style="background:#12493b;padding:24px 28px;border-radius:18px 18px 0 0">
        <p style="margin:0;color:#e9dcb8;font-family:${font};font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600">CheckInn</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700">${esc(n.heading)}</h1>
      </td></tr>
      <tr><td style="padding:22px 28px 8px;color:#121614;font-family:${font};font-size:15px;line-height:22px">Hi ${esc(n.name.split(" ")[0])},<br><br>${esc(n.intro)}</td></tr>
      <tr><td style="padding:4px 28px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>
      ${
        n.link
          ? `<tr><td style="padding:10px 28px 4px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#12493b" style="border-radius:10px"><a href="${esc(n.link.href)}" target="_blank" style="display:inline-block;padding:12px 18px;font-family:${font};font-size:14px;font-weight:600;text-decoration:none;color:#ffffff">${esc(n.link.label)}</a></td></tr></table></td></tr>`
          : ""
      }
      <tr><td style="padding:8px 28px 26px;color:#646a66;font-family:${font};font-size:13px;line-height:20px">${esc(n.note)}</td></tr>
    </table>
  </td></tr></table>
</body></html>`,
    });
  } catch (e) {
    console.error(`Account email to ${n.to} failed:`, e);
  }
}

const whenNow = () => new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

/** Tells someone their CheckInn account (or the admin panel) was just signed in to. */
export function sendSignInAlert(a: { to: string; name: string; admin?: boolean; method: string; device: string; place: string; ip: string }) {
  const what = a.admin ? "the CheckInn admin panel" : "your CheckInn account";
  return sendNotice({
    to: a.to,
    name: a.name,
    subject: a.admin ? "New sign-in to the CheckInn admin panel" : "New sign-in to your CheckInn account",
    heading: "New sign-in",
    intro: `Someone just signed in to ${what}.`,
    rows: [["When", `${whenNow()} (India time)`], ["How", a.method], ["Device", a.device], ["Where", `${a.place} (approximate)`], ["IP address", a.ip]],
    note: a.admin
      ? "If this was you, there's nothing to do. If not, change this admin's password straight away in Admin → Users."
      : "If this was you, there's nothing to do. If not, change your password or sign in with Google, and reply to this email so we can help.",
  });
}

/** Tells the account owner that sign-in was paused after repeated wrong passwords. */
export function sendLockoutAlert(a: { to: string; name: string; admin?: boolean; minutes: number; device: string; place: string; ip: string }) {
  return sendNotice({
    to: a.to,
    name: a.name,
    subject: a.admin ? "Admin sign-in paused after wrong passwords" : "Sign-in to your CheckInn account paused",
    heading: "Too many wrong passwords",
    intro: `There were several wrong passwords for ${a.admin ? "this admin account" : "your account"}, so we've paused password sign-in for ${a.minutes} minutes.`,
    rows: [["When", `${whenNow()} (India time)`], ["Device", a.device], ["Where", `${a.place} (approximate)`], ["IP address", a.ip]],
    note: "If this was you, wait a few minutes and try again. If not, someone may be guessing your password: consider changing it once you can sign in.",
  });
}

/**
 * After a booking is cancelled: the guest is told (if they left an email), and when the guest cancelled it themselves,
 * every admin is told too, so the freed table can be filled. Never throws.
 */
export async function sendCancellationEmails(code: string, by: "guest" | "admin") {
  if (!emailEnabled()) return;
  try {
    const b = await getBooking(code);
    if (!b || b.status !== "cancelled") return;
    const when = `${fmtDate(b.booking_date, { weekday: "long", day: "numeric", month: "long" })}, ${fmtTime(b.slot_time)}`;
    const rows: [string, string][] = [
      ["Restaurant", `${b.restaurant_name}, ${b.restaurant_area}`],
      ["When", when],
      ["Guests", String(b.guests)],
      ["Booking code", b.code],
    ];
    const jobs: Promise<void>[] = [];
    if (b.guest_email) {
      jobs.push(
        sendNotice({
          to: b.guest_email,
          name: b.guest_name,
          subject: `Booking cancelled: ${b.restaurant_name}, ${fmtDate(b.booking_date)} at ${fmtTime(b.slot_time)}`,
          heading: "Your booking is cancelled",
          intro:
            by === "admin"
              ? `We've had to cancel your table at ${b.restaurant_name}. We're sorry for the change of plans.`
              : `Your table at ${b.restaurant_name} has been cancelled, as you asked.`,
          rows,
          link: { href: `${siteUrl()}/restaurants`, label: "Book another table" },
          note:
            by === "admin"
              ? "Questions about this? Just reply to this email."
              : "Didn't cancel this yourself? Reply to this email straight away and we'll help.",
        }),
      );
    }
    if (by === "guest") {
      const admins = await query<{ name: string; email: string }>("SELECT name, email FROM admins");
      for (const a of admins) {
        jobs.push(
          sendNotice({
            to: a.email,
            name: a.name,
            subject: `Cancelled: ${b.restaurant_name}, ${fmtDate(b.booking_date)} at ${fmtTime(b.slot_time)} (${b.guests} guests)`,
            heading: "A booking was cancelled",
            intro: `${b.guest_name} cancelled their table, so ${b.guests} ${b.guests === 1 ? "seat is" : "seats are"} free again.`,
            rows: [...rows, ["Guest", `${b.guest_name} · ${b.guest_phone}`], ...(b.coupon_code ? ([["Offer freed", b.coupon_code]] as [string, string][]) : [])],
            link: { href: `${siteUrl()}/admin/bookings?q=${b.code}&status=all`, label: "View in admin" },
            note: "You're getting this because you're a CheckInn admin.",
          }),
        );
      }
    }
    await Promise.all(jobs);
  } catch (e) {
    console.error(`Cancellation emails for ${code} failed:`, e);
  }
}

type ListingRow = { id: number; name: string; city: string; area: string; address: string; owner_name: string; owner_email: string; owner_phone: string; status: string; reject_reason: string | null; slug: string | null };
const getListing = async (id: number) =>
  (await query<ListingRow>("SELECT l.*, r.slug FROM listings l LEFT JOIN restaurants r ON r.id = l.restaurant_id WHERE l.id = $1", [id]))[0];

/** A new owner listing: the owner hears it arrived, and every admin is asked to review it. Never throws. */
export async function sendListingReceived(id: number) {
  if (!emailEnabled()) return;
  try {
    const l = await getListing(id);
    if (!l) return;
    const rows: [string, string][] = [["Restaurant", l.name], ["Area", `${l.area}, ${l.city}`], ["Address", l.address]];
    const admins = await query<{ name: string; email: string }>("SELECT name, email FROM admins");
    await Promise.all([
      sendNotice({
        to: l.owner_email,
        name: l.owner_name,
        subject: `We've received your listing: ${l.name}`,
        heading: "Listing received",
        intro: `Thanks for listing ${l.name} on CheckInn. Our team will check the details and photo, usually within 2 working days.`,
        rows,
        note: "We'll email you as soon as it's live. To change anything meanwhile, just reply to this email.",
      }),
      ...admins.map((a) =>
        sendNotice({
          to: a.email,
          name: a.name,
          subject: `New restaurant waiting for approval: ${l.name}, ${l.city}`,
          heading: "A restaurant is waiting for approval",
          intro: `${l.owner_name} listed ${l.name}. It goes on the website once you approve it.`,
          rows: [...rows, ["Owner", `${l.owner_name} · ${l.owner_phone} · ${l.owner_email}`]],
          link: { href: `${siteUrl()}/admin/listings`, label: "Review in admin" },
          note: "You're getting this because you're a CheckInn admin.",
        }),
      ),
    ]);
  } catch (e) {
    console.error(`Listing emails for ${id} failed:`, e);
  }
}

/** Tells the owner whether their listing was approved (with a link to it) or not (with the admin's reason). Never throws. */
export async function sendListingDecision(id: number) {
  if (!emailEnabled()) return;
  try {
    const l = await getListing(id);
    if (!l || l.status === "pending") return;
    const approved = l.status === "approved";
    await sendNotice({
      to: l.owner_email,
      name: l.owner_name,
      subject: approved ? `${l.name} is now live on CheckInn` : `About your CheckInn listing: ${l.name}`,
      heading: approved ? "Your restaurant is live" : "Listing not approved",
      intro: approved
        ? `Good news: ${l.name} is now on CheckInn, and guests can book tables straight away.`
        : `We couldn't add ${l.name} to CheckInn this time.`,
      rows: approved ? [["Restaurant", l.name], ["Area", `${l.area}, ${l.city}`]] : [["Reason", l.reject_reason || "The details couldn't be confirmed."]],
      link: approved && l.slug ? { href: `${siteUrl()}/restaurants/${l.slug}`, label: "See your page" } : undefined,
      note: approved
        ? "Bookings and their booking fees will come to you as guests book. Questions? Just reply to this email."
        : "You're welcome to send it again with the changes, or reply to this email and we'll help.",
    });
  } catch (e) {
    console.error(`Listing decision email for ${id} failed:`, e);
  }
}
