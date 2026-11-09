"use client";

import dynamic from "next/dynamic";

// The pixel fish (M2.5) show only while the aquarium is on; its drawing
// code loads only then, not with every visit to the style guide (D120).
export const PixelFishLazy = dynamic(() =>
  import("./PixelFishSection").then((m) => m.PixelFishSection),
);
