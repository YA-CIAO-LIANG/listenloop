"use client";

import dynamic from "next/dynamic";

/**
 * The aquarium, loaded only in the browser and only on the home page, so
 * its code never weighs on other pages or the server render.
 */
export const HomeAquarium = dynamic(
  () => import("./AquariumBackground").then((m) => m.AquariumBackground),
  { ssr: false },
);
