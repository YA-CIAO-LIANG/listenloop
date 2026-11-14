import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { SECURITY_HEADERS } from "./lib/security/csp";

// Connects next-intl to the request config in ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

// cacheComponents is off: UI copy depends on the locale cookie, so every page
// renders per request anyway. Revisit when upgrading to Next 17, where it
// becomes the default (see docs: migrating-to-cache-components).
const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js": it only tells attackers what to try
  // (ZAP baseline, D158).
  poweredByHeader: false,
  // The proxy redirects trailing slashes itself, without a body: Next's
  // redirect has a body with no Content-Type (ZAP 10019, D174).
  skipTrailingSlashRedirect: true,
  // The admin's system documents are read from docs/system/ at request time.
  outputFileTracingIncludes: {
    "/admin/docs": ["./docs/system/**/*.md"],
    "/blog/[slug]": ["./content/blog/*.md"],
  },
  // Every deployment's functions count towards Vercel Hobby's 10 GB
  // "Functions Storage" (D175). Keep out what the server never loads:
  // sharp is only Next's self-hosted image optimizer (on Vercel, images
  // are optimized by the platform; next/og draws with its own resvg), and
  // the project's own non-runtime folders. `npm run size:functions`
  // shows the result.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/sharp/**",
      "node_modules/@img/**",
      "node_modules/typescript/**",
      "node_modules/@playwright/**",
      "node_modules/playwright*/**",
      "node_modules/vitest/**",
      "node_modules/@vitest/**",
      "node_modules/docx/**",
      "tests/**",
      "e2e/**",
      "evals/**",
      "scripts/**",
      "qa/**",
      "usability/**",
      "loadtest/**",
      "marketing/**",
      "brand/**",
      "supabase/**",
      "docs/!(system)/**",
      "docs/*",
      "content/!(blog)/**",
      "package-lock.json",
    ],
  },
  // On every response, pages and files alike (D63).
  async headers() {
    return [
      { source: "/:path*", headers: [...SECURITY_HEADERS] },
      // The service worker is checked for updates on every visit (D64).
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },
  // /create moved under My materials (D26); keep old links working.
  async redirects() {
    return [
      { source: "/create", destination: "/materials/new", permanent: true },
    ];
  },
  experimental: {
    // Speech to text gets ~25 s of 16 kHz WAV per request (~800 KB, D130).
    serverActions: { bodySizeLimit: "2mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
