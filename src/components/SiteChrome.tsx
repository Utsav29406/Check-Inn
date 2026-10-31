import { getFestival } from "@/lib/festival";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MobileTabBar } from "./MobileTabBar";
import { DiwaliDefs, GoldLights } from "./diwali/Art";
import { DiwaliBanner, PreviewPill } from "./diwali/Chrome";

/** The customer site's frame: top bar, footer and the phone tab bar. The admin panel has its own. */
export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const festival = await getFestival();
  return (
    <>
      {festival && (
        <>
          <DiwaliDefs />
          <DiwaliBanner festival={festival} />
        </>
      )}
      <Navbar festive={Boolean(festival)} />
      {/* On phones the string lights would sit on the first line of text, so leave them room. */}
      <main className={`flex-1 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0 ${festival ? "max-md:pt-3" : ""}`}>{children}</main>
      {festival && (
        <div className="relative z-10 h-0">
          <GoldLights className="absolute inset-x-0 top-0" />
        </div>
      )}
      <Footer />
      <MobileTabBar />
      {festival?.preview && <PreviewPill />}
    </>
  );
}
