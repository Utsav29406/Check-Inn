import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "pdfkit"],
  // The invoice PDF reads its fonts from disk at runtime.
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**"] },
  // Listing and restaurant forms carry one photo (shrunk in the browser to well under 1.5 MB).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
