import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin | CheckInn", robots: { index: false, follow: false } };

/** The admin area has no customer navigation; (panel) adds the admin sidebar. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-sand/50">{children}</div>;
}
