import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "pdfkit"],
  // The invoice PDF reads its fonts from disk at runtime.
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**"] },
  // Listing and restaurant forms carry one photo (shrunk in the browser to well under 1.5 MB).
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
    // Going back to a page seen in the last 30 seconds (the phone tab bar, say) shows it straight away instead of
    // fetching it again. Bookings, payments and other changes refresh it as before.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
