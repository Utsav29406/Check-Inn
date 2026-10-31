"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cancelBooking } from "@/app/actions";

/** Two-tap cancel: the first tap asks for confirmation, the second cancels. */
export function CancelButton({ code, className }: { code: string; className?: string }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <form
      action={cancelBooking}
      className="contents"
      onSubmit={(e) => {
        if (!confirming) {
          e.preventDefault();
          setConfirming(true);
          setTimeout(() => setConfirming(false), 4000);
        }
      }}
    >
      <input type="hidden" name="code" value={code} />
      <button className={className}>
        <X className="h-5 w-5" />
        {confirming ? "Tap to confirm" : "Cancel"}
      </button>
    </form>
  );
}
