"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cancelBooking } from "@/app/actions";

/**
 * Two-tap cancel: the first tap asks for confirmation, the second cancels.
 * token: the booking-email link's token, for guests who aren't signed in. label: the text before confirming.
 */
export function CancelButton({ code, token, label = "Cancel", icon = true, className }: { code: string; token?: string; label?: string; icon?: boolean; className?: string }) {
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
      {token && <input type="hidden" name="t" value={token} />}
      <Submit className={className} icon={icon} text={confirming ? "Tap to confirm" : label} />
    </form>
  );
}

function Submit({ className, icon, text }: { className?: string; icon: boolean; text: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : icon && <X className="h-5 w-5" />}
      {pending ? "Cancelling…" : text}
    </button>
  );
}
