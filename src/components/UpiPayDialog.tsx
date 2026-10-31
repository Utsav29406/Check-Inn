"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check, Clock, Copy, Loader2, Smartphone, X } from "lucide-react";
import { submitUtr, type UpiRequest } from "@/app/actions";
import { inr } from "@/lib/constants";

/**
 * Pay the booking fee by scanning our UPI QR (or opening a UPI app on phones), then enter the UTR to confirm.
 * A sheet on phones, a centred dialog from 768px up.
 */
export function UpiPayDialog({ upi, summary, onCancel }: { upi: UpiRequest; summary: string; onCancel: () => void }) {
  const [utr, setUtr] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(upi.holdMinutes * 60);

  const cancel = () => {
    if (window.confirm("Close without finishing? Your table will be released.")) onCancel();
  };

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearInterval(timer);
      document.body.style.overflow = prev;
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(upi.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const valid = /^\d{12}$/.test(utr);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      const res = await submitUtr(upi.code, utr);
      if (res?.error) setError(res.error);
    });
  };
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pay by UPI"
      onKeyDown={(e) => e.key === "Escape" && cancel()}
      className="fixed inset-0 z-70 flex items-end justify-center bg-brand-900/50 md:items-center md:p-6"
    >
      <div className="no-scrollbar max-h-[94vh] supports-[height:100dvh]:max-h-[94dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white shadow-2xl md:max-w-md md:rounded-3xl">
        <div className="relative bg-brand-600 px-6 py-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-300">Pay by UPI</p>
          <h2 className="mt-1 font-display text-2xl font-bold">Pay {inr(upi.amount)}</h2>
          <p className="mt-0.5 text-sm text-white/75">{summary}</p>
          <button type="button" onClick={cancel} aria-label="Close" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/15">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div>
            <p className="text-sm font-semibold">1. Scan and pay exactly {inr(upi.amount)}</p>
            <div
              className="mx-auto mt-3 aspect-square w-52 rounded-2xl p-2 ring-1 ring-black/10 [&>svg]:h-full [&>svg]:w-full"
              role="img"
              aria-label={`UPI QR code to pay ${inr(upi.amount)}`}
              dangerouslySetInnerHTML={{ __html: upi.qr }}
            />
            <p className="mt-2 text-center text-xs text-muted">Google Pay, PhonePe, Paytm, BHIM or any UPI app</p>
            <a
              href={upi.link}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-brand-600 py-3 font-semibold text-brand-600 md:hidden"
            >
              <Smartphone className="h-5 w-5" /> Open UPI app on this phone
            </a>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-sand px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate">
                <span className="text-muted">UPI ID </span>
                <b>{upi.upiId}</b>
              </span>
              <button type="button" onClick={copy} className="flex shrink-0 items-center gap-1 font-semibold text-brand-600">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <form onSubmit={submit} className="border-t border-black/5 pt-5">
            <label htmlFor="utr" className="text-sm font-semibold">
              2. Enter the UTR (UPI reference number)
            </label>
            <p className="mt-0.5 text-xs text-muted">The 12-digit number in your payment app after paying, e.g. &ldquo;UPI Ref No.&rdquo; or &ldquo;UTR&rdquo;.</p>
            <input
              id="utr"
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="123456789012"
              className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 font-mono text-lg tracking-widest outline-none focus:border-brand-500"
            />
            {error && <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
            <button
              disabled={!valid || pending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm my table
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              <Clock className="h-3.5 w-3.5" />
              {secondsLeft > 0 ? `Table held for ${mm}:${ss}` : "Hold time is over. Finish now to keep the table."}
            </p>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
