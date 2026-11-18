import type { MetadataRoute } from "next";

/*
 * Makes CheckInn installable from the browser ("Install app" / "Add to Home Screen"): it then opens full screen from
 * its own icon, like a store app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CheckInn — Restaurant Table Booking",
    short_name: "CheckInn",
    description: "Reserve tables at the finest restaurants, with offers taken off automatically.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#061f19",
    theme_color: "#061f19",
    categories: ["food", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the home-screen icon for these.
    shortcuts: [
      { name: "Find a table", url: "/restaurants", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My bookings", url: "/bookings", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Offers", url: "/offers", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
