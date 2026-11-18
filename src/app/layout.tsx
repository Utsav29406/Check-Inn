import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { openingScript } from "@/lib/opening";
import { earlyInstallScript } from "@/lib/install-early";
import { WelcomeToast } from "@/components/WelcomeToast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "CheckInn | Premium Restaurant Booking & Fine Dining Club",
  icons: { icon: "/favicon.svg", apple: "/apple-icon.png?v=2" },
  // Opened from the home screen on iPhones: full screen, named CheckInn (the icon is app/apple-icon.png, listed under icons).
  appleWebApp: { capable: true, title: "CheckInn", statusBarStyle: "default" },
  description: "Reserve tables at the finest restaurants, unlock flat discounts and join the CheckInn dining club.",
};

export const viewport: Viewport = { viewportFit: "cover", themeColor: "#faf8f3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the opening animation's script marks <html> before React loads.
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: openingScript }} />
        <script dangerouslySetInnerHTML={{ __html: earlyInstallScript }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        {children}
        <WelcomeToast />
      </body>
    </html>
  );
}
