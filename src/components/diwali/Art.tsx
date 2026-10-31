/**
 * Diwali artwork in CheckInn's own palette (emerald, champagne gold, cream): brass diyas, gold line mandalas, gold fairy
 * lights and sparkles. Drawn as SVG.
 */

/** Shared gradients for every diya on the page; render once. */
export function DiwaliDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ci-diya-glow">
          <stop offset="0" stopColor="#f3d98f" stopOpacity=".55" />
          <stop offset="1" stopColor="#f3d98f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ci-diya-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#e0a43a" />
          <stop offset=".55" stopColor="#f3d27a" />
          <stop offset="1" stopColor="#fff4cf" />
        </linearGradient>
        <linearGradient id="ci-diya-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9dcb8" />
          <stop offset=".45" stopColor="#bb9d5e" />
          <stop offset="1" stopColor="#7d6434" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** A brass diya with a softly flickering flame. */
export function Diya({ className = "h-10 w-10", delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="24" r="20" fill="url(#ci-diya-glow)" />
      <g className="diya-flame" style={delay ? { animationDelay: `${delay}s` } : undefined}>
        <path d="M32 7C36.5 16 39.5 22 32 32C24.5 22 27.5 16 32 7Z" fill="url(#ci-diya-flame)" />
        <path d="M32 17C34 21 34.8 24 32 28.5C29.2 24 30 21 32 17Z" fill="#fffbea" />
      </g>
      <path d="M8 36C16 33.5 48 33.5 56 36C53 49 43 55 32 55C21 55 11 49 8 36Z" fill="url(#ci-diya-brass)" />
      <ellipse cx="32" cy="36" rx="24" ry="4" fill="#e9dcb8" />
      <ellipse cx="32" cy="36" rx="20" ry="2.2" fill="#957a42" />
      <path d="M15 42.5Q32 49 49 42.5" stroke="#faf8f3" strokeWidth="1" fill="none" opacity=".6" />
    </svg>
  );
}

const ring = (n: number, draw: () => React.ReactNode, offset = 0) =>
  Array.from({ length: n }, (_, i) => (
    <g key={i} transform={`rotate(${offset + (360 / n) * i})`}>
      {draw()}
    </g>
  ));

/** A line-art mandala in a single colour (currentColor), like gold foil on a card. */
export function Mandala({ className = "h-40 w-40" }: { className?: string }) {
  return (
    <svg viewBox="-50 -50 100 100" className={className} fill="none" stroke="currentColor" strokeWidth=".6" aria-hidden="true">
      <circle r="48.5" strokeDasharray=".6 2.4" strokeLinecap="round" />
      <circle r="44" />
      {ring(24, () => <path d="M0-44C3.2-40.5 3.2-37 0-34C-3.2-37-3.2-40.5 0-44Z" />)}
      <circle r="33" />
      {ring(12, () => <path d="M0-33C7-27 7-18 0-13C-7-18-7-27 0-33Z" />)}
      {ring(12, () => <path d="M0-29C3-25 3-20 0-17C-3-20-3-25 0-29Z" />)}
      {ring(12, () => <circle cx="0" cy="-36.5" r=".9" fill="currentColor" stroke="none" />, 15)}
      <circle r="12" />
      {ring(8, () => <path d="M0-12C2.6-9 2.6-6 0-4C-2.6-6-2.6-9 0-12Z" />)}
      <circle r="3" />
      <circle r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A fine string of warm gold fairy lights, as wide as its container. */
export function GoldLights({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none flex h-3 overflow-hidden ${className}`}>
      {Array.from({ length: 80 }, (_, i) => (
        <svg key={i} viewBox="0 0 28 12" className="h-3 w-7 shrink-0">
          <path d="M0 1Q14 6 28 1" fill="none" stroke="#bb9d5e" strokeWidth=".7" opacity=".7" />
          <g className="twinkle" style={{ animationDelay: `${((i * 0.53) % 3).toFixed(2)}s` }}>
            <circle cx="14" cy="6.6" r="3.6" fill="#f3d98f" opacity=".3" />
            <circle cx="14" cy="6.6" r="1.6" fill="#f6e3a8" />
          </g>
        </svg>
      ))}
    </div>
  );
}

/** A four-point gold sparkle that glints on a loop. */
export function Sparkle({ className = "h-4 w-4", delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg viewBox="-10 -10 20 20" className={`sparkle ${className}`} style={{ animationDelay: `${delay}s` }} aria-hidden="true">
      <path d="M0-10C1-3 3-1 10 0C3 1 1 3 0 10C-1 3-3 1-10 0C-3-1-1-3 0-10Z" fill="#e9dcb8" />
    </svg>
  );
}
