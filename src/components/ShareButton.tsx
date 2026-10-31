"use client";

import { useState, type ReactNode } from "react";

/** Uses the phone's share sheet when available, otherwise copies the link. */
export function ShareButton({ title, path, className, children, label = "Share" }: { title: string; path: string; className?: string; children?: ReactNode; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      onClick={async () => {
        const url = new URL(path, window.location.origin).href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch (e) {
            if ((e as Error).name === "AbortError") return;
          }
        }
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {}
      }}
    >
      {children}
      {label && <span>{copied ? "Link copied" : label}</span>}
    </button>
  );
}
