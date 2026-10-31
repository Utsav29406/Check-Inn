"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The opening animation, once per visit: the logo builds up piece by piece, the name settles in, then a gold ring
 * sweeps outwards as the cover fades onto the page (which has loaded underneath). A tap skips it.
 *
 * Every piece is its own element and only moves by transform and opacity, which the browser runs off the main thread,
 * so the animation stays smooth while the page's scripts load (stroke drawing and masks stall on busy phones).
 */
export function OpeningAnimation() {
  const [done, setDone] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document.documentElement.dataset.opening === "off") return setDone(true);
    // Fallback in case animationend never fires (a background tab, say).
    const t = setTimeout(() => setDone(true), 3500);
    return () => clearTimeout(t);
  }, []);

  if (done) return null;
  return (
    <div
      ref={ref}
      className={`opening ${skipping ? "opening-skip" : ""}`}
      aria-hidden="true"
      onClick={() => {
        // Let the page go back to cream straight away instead of after the usual 1.45s.
        document.documentElement.dataset.opening = "done";
        setSkipping(true);
      }}
      onAnimationEnd={(e) => {
        if (e.target === ref.current) setDone(true);
      }}
    >
      <div className="opening-mark">
        <div className="opening-logo-wrap">
          <div className="opening-burst" />
          <div className="opening-logo">
            <svg viewBox="0 0 48 48" className="opening-ring">
              <circle cx="24" cy="24" r="23" />
            </svg>
            <svg viewBox="0 0 48 48" className="opening-dome">
              <path d="M11 33a13 13 0 0 1 26 0z" />
              <circle cx="24" cy="18.8" r="1.7" />
            </svg>
            <svg viewBox="0 0 48 48" className="opening-check">
              <path d="M18 27.5l4 4 8-8.5" />
            </svg>
            <svg viewBox="0 0 48 48" className="opening-plate">
              <rect x="8" y="33" width="32" height="3" rx="1.5" />
            </svg>
          </div>
        </div>
        <div className="opening-text">
          <p className="opening-word font-display">
            Check<span>Inn</span>
          </p>
          <p className="opening-tag">Book the finest tables</p>
        </div>
      </div>
    </div>
  );
}
