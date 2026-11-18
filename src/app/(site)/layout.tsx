import { SiteChrome } from "@/components/SiteChrome";
import { OpeningAnimation } from "@/components/OpeningAnimation";
import { InstallApp } from "@/components/InstallApp";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OpeningAnimation />
      <SiteChrome>{children}</SiteChrome>
      <InstallApp />
    </>
  );
}
