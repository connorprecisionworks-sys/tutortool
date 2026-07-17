import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // The brand logo/mark SVGs (components/brand/logo.tsx) are the only
    // SVGs ever passed to next/image, and they're trusted first-party
    // assets in public/brand/ — Next's image optimizer 400s on any SVG by
    // default (script-injection risk for untrusted sources), so this needs
    // an explicit opt-in. The CSP locks down what a served SVG document
    // can do (no scripts, sandboxed) per Next's own recommendation for
    // this flag, rather than trusting "we control the file" alone.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
