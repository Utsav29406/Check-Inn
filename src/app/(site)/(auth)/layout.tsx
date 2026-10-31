import { Suspense } from "react";
import { AuthScreen } from "@/components/AuthScreen";

/** Shared by /login and /signup so the screen stays mounted and can animate between them. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense>
        <AuthScreen googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />
      </Suspense>
    </>
  );
}
