import Link from "next/link";

/** Animated cloche mark: the lid lifts, steam rises and a check mark is drawn. */
export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`logo-mark ${className}`} aria-hidden="true">
      <circle cx="24" cy="24" r="23" className="fill-brand-600" />
      <g className="logo-steam" fill="none" stroke="#e9dcb8" strokeWidth="1.6" strokeLinecap="round">
        <path d="M18 13c-1.5-1.5 1.5-3 0-4.5" />
        <path d="M24 12c-1.5-1.5 1.5-3 0-4.5" />
        <path d="M30 13c-1.5-1.5 1.5-3 0-4.5" />
      </g>
      <path className="logo-check" d="M18 27.5l4 4 8-8.5" fill="none" stroke="#e9dcb8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <g className="logo-lid">
        <path d="M11 33a13 13 0 0 1 26 0z" fill="#d6bf8a" />
        <path d="M14.5 30a9.5 9.5 0 0 1 6-7" fill="none" stroke="#fbf6e9" strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
        <circle cx="24" cy="18.5" r="2" fill="#d6bf8a" />
      </g>
      <rect x="8" y="33" width="32" height="3" rx="1.5" fill="#e9dcb8" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="CheckInn home">
      <LogoMark />
      <span className={`font-display text-2xl font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Check<span className="text-gold-500 italic">Inn</span>
      </span>
    </Link>
  );
}
