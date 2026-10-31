import { FOOD_TYPES } from "@/lib/constants";
import type { FoodType } from "@/lib/types";

/** The familiar Indian food symbol: green dot for pure veg, red triangle for non-veg. */
export function FoodMark({ type, className = "h-4 w-4" }: { type: FoodType; className?: string }) {
  const color = type === "veg" ? "#15803d" : "#b42318";
  return (
    <svg viewBox="0 0 16 16" role="img" aria-label={FOOD_TYPES[type]} className={`shrink-0 ${className}`}>
      <title>{FOOD_TYPES[type]}</title>
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#fff" stroke={color} strokeWidth="1.6" />
      {type === "veg" ? <circle cx="8" cy="8" r="3.6" fill={color} /> : <path d="M8 4.2l4.1 7.1H3.9z" fill={color} />}
    </svg>
  );
}
