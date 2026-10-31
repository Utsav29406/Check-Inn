/**
 * A party-popper burst of paper confetti from an element: pieces shoot up, then flutter down under gravity. Drawn in a
 * fixed layer on top of the page, so containers that clip their overflow don't cut it off.
 */
const COLOURS = ["#1d6650", "#12493b", "#d6bf8a", "#bb9d5e", "#f6e3a8", "#ffffff", "#e0a43a"];

export function paperBlast(from: Element | null, count = 70) {
  if (!from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = from.getBoundingClientRect();
  const ox = r.left + r.width / 2;
  const oy = r.top + r.height / 2;
  const layer = document.createElement("div");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "80", overflow: "hidden" });
  document.body.appendChild(layer);

  const pieces = Array.from({ length: count }, (_, i) => {
    const piece = document.createElement("span");
    const w = 6 + Math.random() * 6;
    Object.assign(piece.style, {
      position: "absolute",
      left: `${ox}px`,
      top: `${oy}px`,
      width: `${w}px`,
      height: `${w * (1.4 + Math.random() * 0.8)}px`,
      background: COLOURS[i % COLOURS.length],
      borderRadius: "1px",
      boxShadow: "0 1px 1px rgba(6,31,25,.15)",
    });
    layer.appendChild(piece);

    // Thrown up and outwards from across the element's width, then pulled down: a parabola sampled as keyframes.
    const startX = (Math.random() - 0.5) * r.width * 0.8;
    const vx = (Math.random() - 0.5) * 900;
    const vy = -(450 + Math.random() * 550);
    const gravity = 1400;
    const spin = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720);
    const flips = 3 + Math.random() * 5;
    const duration = 1700 + Math.random() * 900;
    const frames: Keyframe[] = [];
    for (let s = 0; s <= 12; s++) {
      const p = s / 12;
      const t = (p * duration) / 1000;
      // Air drag: sideways speed fades, so pieces drift down instead of flying off the screen.
      const x = startX + vx * (1 - Math.exp(-2.2 * t)) / 2.2;
      const y = vy * t + 0.5 * gravity * t * t;
      frames.push({
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${spin * p}deg) rotateX(${flips * 360 * p}deg)`,
        opacity: p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25,
      });
    }
    return piece.animate(frames, { duration, easing: "linear" }).finished;
  });
  Promise.all(pieces).finally(() => layer.remove());
}
