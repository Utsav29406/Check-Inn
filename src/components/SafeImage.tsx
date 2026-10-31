"use client";

import { useEffect, useRef, useState } from "react";

/** Plain <img> that falls back to a branded gradient if the remote photo fails to load. */
export function SafeImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // A photo can fail before React is listening (it starts loading with the server HTML): catch that on mount.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${className} bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 flex items-center justify-center`}
      >
        <span className="font-display text-3xl italic text-gold-300/80">{alt.charAt(0)}</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />;
}
