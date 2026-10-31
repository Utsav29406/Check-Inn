"use client";

import { useActionState } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { emailReminder } from "@/app/admin/actions";
import { smallBtn } from "./ui";

/** Emails the guest a reminder of their table, and says when the last one went out. */
export function ReminderButton({ code, sentAt }: { code: string; sentAt: string | null }) {
  const [state, action, pending] = useActionState(emailReminder, undefined);
  const sent = state?.success || sentAt;
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="code" value={code} />
      <button
        disabled={pending}
        title={sentAt ? `Last reminder ${new Date(sentAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}` : undefined}
        className={`${smallBtn} flex items-center gap-1 border border-brand-500/30 text-brand-600 disabled:opacity-50`}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : sent ? <Check className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
        {sent ? "Reminded · resend" : "Email reminder"}
      </button>
      {state?.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
