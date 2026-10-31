import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { SiteChrome } from "@/components/SiteChrome";

export default function NotFound() {
  return (
    <SiteChrome>
    <div className="flex flex-col items-center px-4 py-28 text-center">
      <LogoMark className="h-20 w-20" />
      <h1 className="mt-6 font-display text-4xl font-bold">This table doesn&apos;t exist</h1>
      <p className="mt-2 text-muted">The page you&apos;re looking for has been moved or never existed.</p>
      <Link href="/" className="mt-8 rounded-full bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">Back to home</Link>
    </div>
    </SiteChrome>
  );
}
