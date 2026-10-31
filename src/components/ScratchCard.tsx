"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Gift, Loader2, Sparkles } from "lucide-react";
import { scratchMyCard } from "@/app/actions";
import type { ScratchReveal } from "@/lib/types";
import { Mandala } from "./diwali/Art";

const CLEAR_TO_REVEAL = 0.45;

/**
 * A gold-foil card the guest scratches off (finger or mouse) to see what they won. The prize is drawn on the server
 * when scratching starts, so it can't be read from the page beforehand.
 */
export function ScratchCard({
  id,
  initial,
  used = false,
  label,
  festive = false,
}: {
  id: number;
  initial: ScratchReveal | null;
  used?: boolean;
  label?: string;
  /** Diwali foil and colours. */
  festive?: boolean;
}) {
  const [reveal, setReveal] = useState(initial);
  const [error, setError] = useState<string>();
  // foil: still covering; fading: scratched enough, foil fading out; gone: removed.
  const [foil, setFoil] = useState<"foil" | "fading" | "gone">(initial ? "gone" : "foil");
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const started = useRef(false);
  const celebrated = useRef(Boolean(initial));

  const start = () => {
    if (started.current) return;
    started.current = true;
    scratchMyCard(id)
      .then((r) => (r.reveal ? setReveal(r.reveal) : setError(r.error)))
      .catch(() => setError("Couldn't reach CheckInn. Check your connection and try again."));
  };

  const finish = () => {
    start();
    setFoil((f) => (f === "foil" ? "fading" : f));
  };

  useEffect(() => {
    if (foil !== "fading") return;
    const t = setTimeout(() => setFoil("gone"), 550);
    return () => clearTimeout(t);
  }, [foil]);

  useEffect(() => {
    if (!reveal?.won || foil === "foil" || celebrated.current) return;
    celebrated.current = true;
    burst(wrapRef.current);
  }, [reveal, foil]);

  useEffect(() => {
    if (initial) return;
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    let scratched = false;

    const paint = () => {
      if (scratched) return;
      const { width, height } = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      const g = ctx.createLinearGradient(0, 0, width, height);
      const stops = ["#e9dcb8", "#bb9d5e", "#ecdfbd", "#bb9d5e", "#957a42"];
      [0, 0.42, 0.5, 0.58, 1].forEach((at, i) => g.addColorStop(at, stops[i]));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      // Foil sparkle: a soft diamond lattice.
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      for (let y = 8; y < height; y += 18) {
        for (let x = (y / 18) % 2 ? 8 : 17; x < width; x += 18) {
          ctx.beginPath();
          ctx.moveTo(x, y - 2.5);
          ctx.lineTo(x + 2.5, y);
          ctx.lineTo(x, y + 2.5);
          ctx.lineTo(x - 2.5, y);
          ctx.fill();
        }
      }
      const css = getComputedStyle(document.documentElement);
      const display = css.getPropertyValue("--font-playfair").trim() || "Georgia, serif";
      const sans = css.getPropertyValue("--font-inter").trim() || "system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (festive) {
        // Gold-foil mandala rings in the corners, as on the rest of the Diwali theme.
        ctx.strokeStyle = "rgba(11,55,44,0.28)";
        ctx.lineWidth = 1;
        for (const [cx, cy] of [[0, 0], [width, height]]) {
          for (let r = 22; r <= 70; r += 12) {
            ctx.beginPath();
            ctx.setLineDash(r % 24 ? [1.5, 4] : []);
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);
      }
      ctx.fillStyle = "#0b372c";
      ctx.font = `italic 700 ${Math.round(Math.min(width / 9, 34))}px ${display}`;
      ctx.fillText(festive ? "Happy Diwali" : "Scratch here", width / 2, height / 2 - 6);
      ctx.font = `600 ${Math.round(Math.min(width / 34, 11))}px ${sans}`;
      ctx.fillStyle = "rgba(11,55,44,0.75)";
      const hint = festive ? "SCRATCH FOR YOUR SHAGUN" : "SCRATCH TO REVEAL YOUR REWARD";
      ctx.fillText(hint.split("").join(" "), width / 2, height / 2 + 24);
    };
    paint();
    document.fonts?.ready.then(paint);
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);

    let last: { x: number; y: number } | null = null;
    let moves = 0;
    const point = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const line = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 38;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x + 0.01, to.y);
      ctx.stroke();
    };
    const cleared = () => {
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let clear = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += 4 * 24) {
        total++;
        if (data[i] === 0) clear++;
      }
      return clear / total;
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      scratched = true;
      start();
      canvas.setPointerCapture(e.pointerId);
      last = point(e);
      line(last, last);
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      const p = point(e);
      line(last, p);
      last = p;
      if (++moves % 8 === 0 && cleared() >= CLEAR_TO_REVEAL) finish();
    };
    const up = () => {
      last = null;
      if (cleared() >= CLEAR_TO_REVEAL) finish();
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div className="w-full">
      <div ref={wrapRef} className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5">
        <Prize reveal={reveal} error={error} used={used} festive={festive} />
        {foil !== "gone" && (
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full cursor-grab touch-none transition-opacity duration-500 active:cursor-grabbing ${foil === "fading" ? "opacity-0" : ""}`}
          />
        )}
      </div>
      {foil === "foil" && (
        <button type="button" onClick={finish} className="mt-2 w-full text-center text-xs font-semibold text-muted underline-offset-2 hover:text-brand-600 hover:underline">
          {label ? `${label} · ` : ""}Can&rsquo;t scratch? Reveal instead
        </button>
      )}
    </div>
  );
}

function Prize({ reveal, error, used, festive }: { reveal: ScratchReveal | null; error?: string; used: boolean; festive: boolean }) {
  if (error) return <div className="grid h-full place-items-center bg-sand p-6 text-center text-sm text-muted">{error}</div>;
  if (!reveal) {
    return (
      <div className="grid h-full place-items-center bg-sand">
        <Loader2 className="h-6 w-6 animate-spin text-gold-600" />
      </div>
    );
  }
  if (!reveal.won) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-sand p-6 text-center">
        <Gift className="h-8 w-8 text-gold-500" />
        <p className="mt-2 font-display text-xl font-bold">{reveal.headline}</p>
        <p className="mt-1 text-sm text-muted">{reveal.detail}</p>
      </div>
    );
  }
  return (
    <div
      className="relative isolate flex h-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(120%_120%_at_100%_0%,#1d6650_0%,#061f19_70%)] p-5 text-center text-white"
    >
      {festive && <Mandala className="absolute -top-12 -right-12 -z-10 h-40 w-40 text-gold-400 opacity-30" />}
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gold-300">
        <Sparkles className="h-3.5 w-3.5" /> {used ? "Used" : "You won"}
      </p>
      <p className="mt-1.5 font-display text-2xl leading-tight font-bold [font-variant-numeric:lining-nums]">{reveal.headline}</p>
      <p className="mt-1 text-sm text-white/70">{reveal.detail}</p>
      {!used && (
        <p className="mt-3 flex items-center gap-1.5 rounded-full border border-gold-400/50 px-3 py-1 text-xs font-semibold text-gold-300">
          <Check className="h-3.5 w-3.5" /> Saved, applies on your next booking
        </p>
      )}
      {reveal.validUntil && !used && <p className="mt-2 text-[11px] text-white/55">Valid until {reveal.validUntil}</p>}
    </div>
  );
}

/** A small burst of gold confetti over the card. */
function burst(el: HTMLElement | null) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colours = ["#e9dcb8", "#d6bf8a", "#bb9d5e", "#ffffff"];
  for (let i = 0; i < 22; i++) {
    const dot = document.createElement("span");
    const size = 4 + Math.random() * 5;
    Object.assign(dot.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: `${size}px`,
      height: `${size * (Math.random() > 0.5 ? 1 : 2)}px`,
      background: colours[i % colours.length],
      borderRadius: "2px",
      pointerEvents: "none",
    });
    el.appendChild(dot);
    const angle = (Math.PI * 2 * i) / 22 + Math.random() * 0.4;
    const dist = 70 + Math.random() * 90;
    dot
      .animate(
        [
          { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
          { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) rotate(${Math.random() * 540}deg)`, opacity: 0 },
        ],
        { duration: 900 + Math.random() * 400, easing: "cubic-bezier(.2,.7,.3,1)" },
      )
      .finished.then(() => dot.remove());
  }
}
