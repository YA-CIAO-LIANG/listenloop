"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { portrait } from "@/lib/pixel-fish/creatures";
import type { SpeciesId } from "@/lib/pixel-fish/style";
import type { Fish } from "@/lib/fish";
import { PixelFish } from "./PixelFish";

/**
 * A fish's picture in the shop: its pixel-art portrait (facing right, eyes
 * open), zoomed by the largest whole number that fits the card so pixels
 * stay crisp. Decorative: the name is always shown next to it.
 */
export function FishThumbnail({ fish }: { fish: Fish }) {
  const image = useMemo(() => portrait(fish.id as SpeciesId), [fish.id]);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(
        Math.max(
          1,
          Math.min(
            6,
            Math.floor(Math.min(width / image.width, height / image.height)),
          ),
        ),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [image]);

  return (
    <div
      ref={box}
      aria-hidden="true"
      data-fish={fish.id}
      className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-base bg-band p-4"
    >
      <PixelFish image={image} scale={scale} />
    </div>
  );
}
