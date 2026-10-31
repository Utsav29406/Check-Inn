"use client";

import { useState, type ReactNode } from "react";

/** Simple segmented tabs (used on phones to keep long pages short). */
export function Tabs({ tabs, className = "" }: { tabs: { label: string; content: ReactNode }[]; className?: string }) {
  const [active, setActive] = useState(0);
  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 rounded-xl bg-sand p-1">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            type="button"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${i === active ? "bg-white text-ink shadow-sm" : "text-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-4">
        {tabs[active].content}
      </div>
    </div>
  );
}
