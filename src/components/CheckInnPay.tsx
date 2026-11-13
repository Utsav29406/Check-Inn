"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppWindow, AtSign, Check, ChevronRight, CreditCard, Loader2, Lock, QrCode, ShieldCheck, Smartphone, X, XCircle } from "lucide-react";
import { payMembership, type CheckInnPayBody, type MembershipCheckout } from "@/app/actions";
import { inr } from "@/lib/constants";
import {
  cardBrand,
  cardProblem,
  digits,
  formatCardNumber,
  formatExpiry,
  QR_PAYEE,
  TEST,
  UPI_APPS,
  upiValid,
  type CheckInnPayMethod,
  type UpiAppId,
} from "@/lib/checkinnpay";

/*
 * The CheckInn Pay window: CheckInn's own dummy gateway (rules in lib/checkinnpay), used for Club membership until a
 * real UPI ID is set. Card goes through a bank OTP step. UPI, as real gateways do it: on a laptop a QR code to scan
 * with the phone; on a phone (which can't scan its own screen) a hand-off to a UPI app; on both, a UPI ID that gets an
 * "approve in your app" request. The demo never opens a real app (the payee is made up); a short "opening…" screen
 * stands in for the hand-off. The server (payMembership) decides every outcome.
 */

type Stage = "details" | "otp" | "opening" | "approve" | "processing" | "success" | "declined";

const field =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-base outline-none transition placeholder:text-muted/70 focus:border-brand-500 md:text-sm";
const chip = "rounded-full border border-black/10 px-2.5 py-1 text-[11px] font-medium text-muted transition hover:border-brand-500 hover:text-brand-600";
const primary = "rounded-xl bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-700";
const UPI_WAIT_S = 5;

export function CheckInnPay({ checkout, onDone }: { checkout: MembershipCheckout; onDone: (paid: boolean) => void }) {
  const { amount } = checkout;
  const [method, setMethod] = useState<CheckInnPayMethod>("upi");
  const [stage, setStage] = useState<Stage>("details");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [otp, setOtp] = useState("");
  const [vpa, setVpa] = useState("");
  // UPI: scan a QR (laptops/tablets) or pay in a UPI app (phones, where a QR would be on the same screen as the app
  // that has to scan it), or a UPI ID.
  const [isPhone, setIsPhone] = useState(false);
  const [upiMode, setUpiMode] = useState<"qr" | "app" | "id">("qr");
  const [upiApp, setUpiApp] = useState<UpiAppId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(UPI_WAIT_S);

  useEffect(() => {
    const phone = !window.matchMedia("(min-width: 768px)").matches;
    setIsPhone(phone);
    setUpiMode(phone ? "app" : "qr");
  }, []);

  async function finish(body: CheckInnPayBody) {
    setStage("processing");
    // A moment of "processing", as a bank would take.
    const [result] = await Promise.all([
      payMembership(checkout.id, body).catch(() => ({ paid: false, invalid: false, error: "Couldn't reach CheckInn Pay. Check your connection." })),
      new Promise((r) => setTimeout(r, 1300)),
    ]);
    if (result.paid) {
      setStage("success");
      setTimeout(() => onDone(true), 1400);
    } else if (result.invalid) {
      setError(result.error ?? "Check your details.");
      setStage("details");
    } else {
      setError(result.error ?? "The payment was declined. No money was taken.");
      setStage("declined");
    }
  }

  // UPI: the request waits in the payer's app; here it's approved after a few seconds, or straight away with
  // "I've approved". The count lives in the effect, so a previous attempt's 0 can't fire a new approve screen.
  const approveBody = (): CheckInnPayBody => ({ method: "upi", upi: upiApp ? { app: upiApp } : { vpa } });
  const autoApprove = useRef<() => void>(() => {});
  autoApprove.current = () => finish(approveBody());
  useEffect(() => {
    if (stage !== "approve") return;
    let left = UPI_WAIT_S;
    setWait(left);
    const timer = window.setInterval(() => {
      left -= 1;
      setWait(left);
      if (left <= 0) {
        window.clearInterval(timer);
        autoApprove.current();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [stage]);

  // Phone: "open" the chosen app, then wait for the payer to pay there.
  useEffect(() => {
    if (stage !== "opening") return;
    const timer = window.setTimeout(() => setStage("approve"), 1400);
    return () => window.clearTimeout(timer);
  }, [stage]);

  function continueCard(e: React.FormEvent) {
    e.preventDefault();
    const problem = cardProblem(card);
    if (problem) return setError(problem);
    if (!card.name.trim()) return setError("Enter the name on the card.");
    setError(null);
    setOtp("");
    setStage("otp");
  }

  function continueUpi(e: React.FormEvent) {
    e.preventDefault();
    if (!upiValid(vpa)) return setError("Enter a UPI ID like name@bank.");
    setError(null);
    setUpiApp(null);
    setStage("approve");
  }

  const appName = UPI_APPS.find((a) => a.id === upiApp)?.name ?? "your UPI app";
  const brand = cardBrand(card.number);
  const busy = stage === "processing" || stage === "success";

  // A dialog for keyboards too: focus moves in and stays in, Escape cancels unless a payment is being processed,
  // the page behind doesn't scroll, and focus goes back to the Join button afterwards.
  const panel = useRef<HTMLDivElement>(null);
  const escape = useRef<() => void>(() => {});
  escape.current = () => {
    if (!busy) onDone(false);
  };
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      [...(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])') ?? [])];
    const raf = requestAnimationFrame(() => {
      if (!panel.current?.contains(document.activeElement)) focusables()[0]?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        escape.current();
      } else if (e.key === "Tab") {
        const list = focusables();
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!panel.current?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="CheckInn Pay" className="cpay-backdrop fixed inset-0 z-70 flex items-end justify-center bg-brand-900/60 backdrop-blur-sm md:items-center md:p-6">
      <div
        ref={panel}
        className="cpay-panel no-scrollbar relative max-h-[92vh] w-full overflow-y-auto rounded-t-[1.75rem] bg-cream shadow-2xl supports-[height:100dvh]:max-h-[92dvh] md:max-w-[420px] md:rounded-3xl"
      >
        {/* Header: who is being paid, how much, for what. */}
        <div className="flex items-center justify-between gap-3 bg-[radial-gradient(120%_140%_at_100%_0%,#1d6650_0%,#061f19_70%)] py-4 pl-5 pr-14 text-white">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-gold-300" aria-hidden />
              CheckInn Pay
              <span className="rounded-full bg-gold-400 px-2 py-px text-[10px] font-bold uppercase tracking-wider text-brand-900">Demo</span>
            </p>
            <p className="mt-0.5 text-[11px] text-white/60">CheckInn Club {checkout.plan} · 1 year</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-white/55">Amount</p>
            <p className="font-display text-xl font-semibold">{inr(amount)}</p>
          </div>
          {!busy && (
            <button
              type="button"
              onClick={() => onDone(false)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Cancel payment"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {stage === "details" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Pay with">
                {(
                  [
                    { id: "upi", label: "UPI", icon: Smartphone },
                    { id: "card", label: "Card", icon: CreditCard },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={method === m.id}
                    onClick={() => {
                      setMethod(m.id);
                      setError(null);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition ${
                      method === m.id ? "border-brand-500 bg-brand-50 text-brand-600" : "border-black/10 bg-white text-muted hover:border-black/25"
                    }`}
                  >
                    <m.icon className="h-4 w-4" aria-hidden />
                    {m.label}
                  </button>
                ))}
              </div>

              {method === "card" ? (
                <form onSubmit={continueCard} className="flex flex-col gap-2.5" noValidate>
                  <div className="relative">
                    <input
                      className={`${field} pr-24 font-mono tracking-wider`}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Card number"
                      aria-label="Card number"
                      value={card.number}
                      onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                    />
                    {brand && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded bg-sand px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-ink/80">{brand}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      className={`${field} font-mono`}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="MM / YY"
                      aria-label="Expiry"
                      value={card.expiry}
                      onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                    />
                    <input
                      className={`${field} font-mono`}
                      inputMode="numeric"
                      autoComplete="off"
                      type="password"
                      placeholder="CVV"
                      aria-label="CVV"
                      maxLength={4}
                      value={card.cvv}
                      onChange={(e) => setCard({ ...card, cvv: digits(e.target.value).slice(0, 4) })}
                    />
                  </div>
                  <input
                    className={field}
                    autoComplete="off"
                    placeholder="Name on card"
                    aria-label="Name on card"
                    value={card.name}
                    onChange={(e) => setCard({ ...card, name: e.target.value.slice(0, 60) })}
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted">Test cards:</span>
                    <button type="button" className={chip} onClick={() => setCard({ number: TEST.cardSuccess, expiry: "12 / 30", cvv: "123", name: "Test Diner" })}>
                      Pays
                    </button>
                    <button type="button" className={chip} onClick={() => setCard({ number: TEST.cardDecline, expiry: "12 / 30", cvv: "123", name: "Test Diner" })}>
                      Declined
                    </button>
                  </div>
                  {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
                  <button type="submit" className={`mt-1 ${primary}`}>
                    Pay {inr(amount)}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-sand p-1 text-xs font-semibold" role="tablist" aria-label="UPI">
                    {[
                      isPhone ? ({ id: "app", label: "UPI app", icon: AppWindow } as const) : ({ id: "qr", label: "Scan QR", icon: QrCode } as const),
                      { id: "id", label: "UPI ID", icon: AtSign } as const,
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="tab"
                        aria-selected={upiMode === m.id}
                        onClick={() => {
                          setUpiMode(m.id);
                          setError(null);
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${upiMode === m.id ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                      >
                        <m.icon className="h-3.5 w-3.5" aria-hidden />
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {upiMode === "app" ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm">
                        Pay <b>{inr(amount)}</b> in a UPI app on this phone
                      </p>
                      <ul className="flex flex-col gap-1.5" aria-label="UPI apps">
                        {UPI_APPS.map((a) => (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setError(null);
                                setUpiApp(a.id);
                                setStage("opening");
                              }}
                              className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-3.5 py-3 text-left text-sm transition hover:border-brand-500"
                            >
                              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-600" aria-hidden>
                                {a.id === "other" ? <Smartphone className="h-4 w-4" /> : a.name.charAt(0)}
                              </span>
                              <span className="flex-1 font-medium">{a.name}</span>
                              <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-muted">Demo: no app really opens; the next screen stands in for it.</p>
                    </div>
                  ) : upiMode === "qr" ? (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div
                        className="h-48 w-48 rounded-2xl bg-white p-2.5 shadow-md ring-1 ring-black/5 [&>svg]:h-full [&>svg]:w-full"
                        role="img"
                        aria-label={`UPI QR code to pay ${inr(amount)}`}
                        dangerouslySetInnerHTML={{ __html: checkout.qr }}
                      />
                      <div>
                        <p className="text-sm">
                          Scan with any UPI app to pay <b>{inr(amount)}</b>
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-muted">GPay · PhonePe · Paytm · BHIM · your bank&apos;s app</p>
                      </div>
                      <p className="flex items-center gap-2 text-xs font-medium text-brand-600" aria-live="polite">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        Waiting for payment…
                      </p>
                      <button type="button" onClick={() => finish({ method: "upi", upi: { qr: true } })} className={`w-full ${primary}`}>
                        I&apos;ve paid
                      </button>
                      <div className="flex w-full flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                        <span>
                          Demo QR to <span className="font-mono">{QR_PAYEE}</span>: a real UPI app will refuse it.
                        </span>
                        <button
                          type="button"
                          onClick={() => finish({ method: "upi", upi: { qr: true, simulate: "decline" } })}
                          className="underline underline-offset-2 hover:text-ink"
                        >
                          Simulate a failed payment
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={continueUpi} className="flex flex-col gap-2.5" noValidate>
                      <input
                        className={field}
                        autoComplete="off"
                        autoCapitalize="none"
                        placeholder="UPI ID, e.g. name@okbank"
                        aria-label="UPI ID"
                        value={vpa}
                        onChange={(e) => setVpa(e.target.value.trim().slice(0, 100))}
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-muted">Test IDs:</span>
                        <button type="button" className={chip} onClick={() => setVpa(TEST.upiSuccess)}>
                          {TEST.upiSuccess}
                        </button>
                        <button type="button" className={chip} onClick={() => setVpa(TEST.upiDecline)}>
                          {TEST.upiDecline}
                        </button>
                      </div>
                      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
                      <button type="submit" className={`mt-1 ${primary}`}>
                        Send payment request
                      </button>
                    </form>
                  )}
                </div>
              )}

              <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-muted">
                <Lock className="h-3 w-3" aria-hidden />
                Demo gateway: no real money moves.
              </p>
            </div>
          )}

          {stage === "otp" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit OTP.");
                setError(null);
                finish({ method: "card", card: { number: card.number, expiry: card.expiry, cvv: card.cvv, otp } });
              }}
              className="flex flex-col gap-3"
              noValidate
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{brand ?? "Card"} · Secure check</p>
              <p className="text-sm text-ink/80">
                Your bank sent a one-time password for <b className="text-ink">{inr(amount)}</b> to CheckInn, card ending {digits(card.number).slice(-4)}.
              </p>
              <input
                className={`${field} text-center font-mono text-lg tracking-[0.5em]`}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="••••••"
                aria-label="OTP"
                value={otp}
                onChange={(e) => setOtp(digits(e.target.value).slice(0, 6))}
              />
              <p className="text-[11.5px] text-muted">
                Demo OTP:{" "}
                <button type="button" className="font-mono font-semibold text-brand-600 underline underline-offset-2" onClick={() => setOtp(TEST.otp)}>
                  {TEST.otp}
                </button>
              </p>
              {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
              <button type="submit" className={primary}>
                Verify and pay
              </button>
              <button type="button" onClick={() => setStage("details")} className="text-sm text-muted hover:text-ink">
                Back
              </button>
            </form>
          )}

          {stage === "approve" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center" aria-live="polite">
              <span className="relative grid h-16 w-16 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" aria-hidden />
                <Smartphone className="h-8 w-8 text-brand-600" aria-hidden />
              </span>
              {upiApp ? (
                <>
                  <p className="font-semibold">Complete the payment in {appName}</p>
                  <p className="text-sm text-muted">
                    {inr(amount)} to CheckInn. Come back here when it&apos;s done. Waiting… {Math.max(wait, 0)}s
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Approve the request in your UPI app</p>
                  <p className="text-sm text-muted">
                    Sent to <b className="font-mono text-ink/85">{vpa}</b> for {inr(amount)}. Waiting… {Math.max(wait, 0)}s
                  </p>
                </>
              )}
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => finish(approveBody())} className={`px-5 text-sm ${primary}`}>
                  {upiApp ? "I've paid" : "I've approved"}
                </button>
                <button type="button" onClick={() => setStage("details")} className="rounded-xl border border-black/15 px-5 py-2.5 text-sm font-medium">
                  {upiApp ? "Choose another app" : "Change UPI ID"}
                </button>
              </div>
              {upiApp && (
                <button
                  type="button"
                  onClick={() => finish({ method: "upi", upi: { app: upiApp, simulate: "decline" } })}
                  className="text-[11px] text-muted underline underline-offset-2 hover:text-ink"
                >
                  Simulate a failed payment
                </button>
              )}
            </div>
          )}

          {stage === "opening" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center" aria-live="polite">
              <Loader2 className="h-9 w-9 animate-spin text-brand-600" aria-hidden />
              <p className="font-semibold">Opening {appName}…</p>
              <p className="text-sm text-muted">Pay {inr(amount)} there, then come back to CheckInn.</p>
            </div>
          )}

          {(stage === "processing" || stage === "success") && (
            <div className="flex flex-col items-center gap-3 py-8 text-center" aria-live="polite">
              {stage === "processing" ? (
                <>
                  <Loader2 className="h-9 w-9 animate-spin text-brand-600" aria-hidden />
                  <p className="text-sm text-muted">Processing your payment… don&apos;t close this window.</p>
                </>
              ) : (
                <>
                  <span className="cpay-success grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-white">
                    <Check className="h-7 w-7" aria-hidden />
                  </span>
                  <p className="font-semibold">Payment successful</p>
                  <p className="text-sm text-muted">{inr(amount)} paid to CheckInn · Welcome to the Club!</p>
                </>
              )}
            </div>
          )}

          {stage === "declined" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center" role="alert">
              <XCircle className="h-11 w-11 text-red-600" aria-hidden />
              <p className="font-semibold">Payment failed</p>
              <p className="max-w-xs text-sm text-muted">{error}</p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStage("details");
                  }}
                  className={`px-5 text-sm ${primary}`}
                >
                  Try again
                </button>
                <button type="button" onClick={() => onDone(false)} className="rounded-xl border border-black/15 px-5 py-2.5 text-sm font-medium">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
