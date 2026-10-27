"use client";

import { useEffect, useRef } from "react";
import type { PixelImage } from "@/lib/pixel-fish/types";

const sources = new WeakMap<PixelImage, HTMLCanvasElement>();

/**
 * The image as a small canvas at its own size, made once and reused, so
 * drawing a frame is a single drawImage.
 */
export function pixelSource(image: PixelImage): HTMLCanvasElement | null {
  const cached = sources.get(image);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.putImageData(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
    0,
    0,
  );
  sources.set(image, canvas);
  return canvas;
}

/**
 * Sizes a canvas to `width × height` pixel-art pixels at an integer `scale`
 * (times the device pixel ratio), with smoothing off so pixels stay crisp.
 * Returns its 2D context, or null where canvas isn't available.
 */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  scale: number,
): CanvasRenderingContext2D | null {
  const ratio = Math.max(1, Math.round(window.devicePixelRatio || 1));
  canvas.width = width * scale * ratio;
  canvas.height = height * scale * ratio;
  canvas.style.width = `${width * scale}px`;
  canvas.style.height = `${height * scale}px`;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingEnabled = false;
  context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
  return context;
}

type PixelFishProps = {
  image: PixelImage;
  /** Whole-number zoom; pixel art only stays sharp at integer scales. */
  scale: number;
  className?: string;
};

/** One still pixel-art frame (decorative; give it nearby text). */
export function PixelFish({ image, scale, className }: PixelFishProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = prepareCanvas(canvas, image.width, image.height, scale);
    const source = pixelSource(image);
    if (context && source) context.drawImage(source, 0, 0);
  }, [image, scale]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
