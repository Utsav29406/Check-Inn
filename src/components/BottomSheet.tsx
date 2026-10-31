"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Phone-only sheet that slides up from the bottom. Locks page scroll and closes on Escape or backdrop tap.
 * Rendered into <body> so a parent with backdrop-filter or transform can't trap its fixed positioning.
 */
export function BottomSheet({
  open,
  onClose,
  label,
  eyebrow,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Focus moves into the sheet, and back to whatever opened it when it closes.
    const back = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      back?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className={`fixed inset-0 z-60 md:hidden ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-brand-900/45 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`absolute inset-x-0 bottom-0 flex max-h-[88vh] supports-[height:100dvh]:max-h-[88dvh] flex-col rounded-t-[1.75rem] bg-cream shadow-2xl transition-transform duration-450 [transition-timing-function:cubic-bezier(.2,.8,.2,1)] ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-black/15" />
        <div className="flex items-center justify-between px-5 pt-2 pb-1">
          <div>
            {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-600">{eyebrow}</p>}
            <h2 className="font-display text-2xl font-bold">{label}</h2>
          </div>
          <button ref={closeBtn} type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-black/5 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
