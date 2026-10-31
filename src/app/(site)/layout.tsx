import { SiteChrome } from "@/components/SiteChrome";
import { OpeningAnimation } from "@/components/OpeningAnimation";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OpeningAnimation />
      <SiteChrome>{children}</SiteChrome>
    </>
  );
}
