import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { SECURITY_HEADERS } from "./lib/security/csp";

// Connects next-intl to the request config in ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

// cacheComponents is off: UI copy depends on the locale cookie, so every page
// renders per request anyway. Revisit when upgrading to Next 17, where it
// becomes the default (see docs: migrating-to-cache-components).
const nextConfig: NextConfig = {
  // The admin's system documents are read from docs/system/ at request time.
  outputFileTracingIncludes: { "/admin/docs": ["./docs/system/**/*.md"] },
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
