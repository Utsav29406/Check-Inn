import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { openingScript } from "@/lib/opening";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "CheckInn | Premium Restaurant Booking & Fine Dining Club",
  icons: { icon: "/favicon.svg" },
  description: "Reserve tables at the finest restaurants, unlock flat discounts and join the CheckInn dining club.",
};

export const viewport: Viewport = { viewportFit: "cover", themeColor: "#faf8f3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the opening animation's script marks <html> before React loads.
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: openingScript }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">{children}</body>
    </html>
  );
}
