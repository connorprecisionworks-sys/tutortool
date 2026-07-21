import type { NextConfig } from "next";
import path from "node:path";

// Built from env at config-eval time (Node, build time) rather than
// hardcoded, since the Supabase project host is per-deployment. Falls back
// to a permissive wildcard only when the var is genuinely unset (local
// scripts/tooling that import next.config without full env) so this file
// never throws during, e.g., `next lint`.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "https://*.supabase.co";
  } catch {
    return "https://*.supabase.co";
  }
})();

// No security-header config existed anywhere in the app (checked next.config.ts
// and vercel.json) before this — flagged in a production-readiness review as
// a real gap for a Stripe-integrated, PII-handling app. No Stripe.js/Elements
// embed and no third-party iframe embedding this app exist anywhere in the
// codebase (verified by grep), so this can be reasonably strict rather than
// permissive-by-default.
// Next/React dev mode (Turbopack HMR, React's dev-only stack-trace
// reconstruction) calls eval() and gets hard-blocked without this — verified
// via a browser console check against the dev server. React never uses
// eval() in production, so this is dev-only; production keeps the tighter
// policy.
const isDev = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  // The root layout's theme-init script (app/layout.tsx) is a small inline
  // <script>; there's no nonce/hash plumbing in this build, so 'unsafe-inline'
  // is required here rather than tightened further.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHost} https://*.posthog.com`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
  turbopack: {
    root: path.join(__dirname),
  },
  env: {
    // Vercel sets VERCEL_GIT_COMMIT_SHA server-side only; aliasing it here
    // inlines a short build id into the client bundle so the F1 feedback
    // widget (build-queue.md) can attach "what version were you on" to a
    // diagnostic report without a round trip. Falls back to "dev" locally.
    NEXT_PUBLIC_APP_VERSION: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
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
