import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Connects next-intl to the request config in ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

// cacheComponents is off: UI copy depends on the locale cookie, so every page
// renders per request anyway. Revisit when upgrading to Next 17, where it
// becomes the default (see docs: migrating-to-cache-components).
const nextConfig: NextConfig = {
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
