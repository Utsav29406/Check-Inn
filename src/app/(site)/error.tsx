"use client";

import { LogoMark } from "@/components/Logo";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-28 text-center">
      <LogoMark className="h-20 w-20" />
      <h1 className="mt-6 font-display text-4xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted">
        {process.env.NODE_ENV === "development" ? error.message : "We couldn't load this page. Please try again in a moment."}
      </p>
      <button onClick={reset} className="mt-8 rounded-full bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">Try again</button>
    </div>
  );
}
