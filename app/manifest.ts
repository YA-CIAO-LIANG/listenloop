import type { MetadataRoute } from "next";

/**
 * The web app manifest (P2, D64): installable from the browser, and what
 * the Android app (Trusted Web Activity) is built from. Colors are the
 * design system's ink and ground; icons come from brand/icon.svg
 * (scripts/brand-assets.mts).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ListenLoop：7 天英語聽力循環",
    short_name: "ListenLoop",
    description:
      "一份素材練 7 天：聽寫、跟讀、再聽寫，聽清楚每一個字。A seven-day English listening loop.",
    lang: "zh-Hant",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fafaf8",
    theme_color: "#141414",
    categories: ["education"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
