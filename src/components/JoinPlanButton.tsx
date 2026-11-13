"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { startMembership, submitMembershipUtr, type MembershipCheckout } from "@/app/actions";
import { inr } from "@/lib/constants";
import { UpiPayDialog } from "./UpiPayDialog";

/**
 * Join or upgrade a CheckInn Club plan: opens CheckInn's UPI checkout for the plan's price.
 * Signed-out visitors go to sign in first.
 */
export function JoinPlanButton({ tier, label, signedIn, className }: { tier: string; label: string; signedIn: boolean; className: string }) {
  const router = useRouter();
  const [checkout, setCheckout] = useState<MembershipCheckout | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const open = () => {
    if (!signedIn) return router.push("/login?next=/membership");
    setError(undefined);
    start(async () => {
      const res = await startMembership(tier);
      if (res.checkout) setCheckout(res.checkout);
      else setError(res.error);
    });
  };

  return (
    <>
      {checkout && (
        <UpiPayDialog
          upi={checkout}
          summary={`CheckInn Club ${checkout.plan} · 1 year · ${inr(checkout.amount)}`}
          onSubmit={async (utr) => {
            const res = await submitMembershipUtr(checkout.id, utr);
            if (!res?.error) {
              setCheckout(null);
              router.refresh();
            }
            return res;
          }}
          confirmLabel="Send for confirmation"
          closeWarning="Close without finishing? If you've already paid, enter the UTR first so we can start your membership."
          onCancel={() => setCheckout(null)}
        />
      )}
      <button type="button" onClick={open} disabled={pending} className={className}>
        {pending && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
        {label}
      </button>
      {error && <p className="mt-2 text-center text-sm text-red-700">{error}</p>}
    </>
  );
}
