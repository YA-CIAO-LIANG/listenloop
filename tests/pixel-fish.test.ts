import { describe, expect, it } from "vitest";
import {
  TAIL_FRAMES,
  fishFrames,
  mirror,
  renderFish,
  squash,
} from "@/lib/pixel-fish/render";
import { clownfish } from "@/lib/pixel-fish/species/clownfish";
import { renderTank } from "@/lib/pixel-fish/tank";
import type { PixelImage } from "@/lib/pixel-fish/types";

const pixel = (image: PixelImage, x: number, y: number) =>
  Array.from(
    image.data.subarray(
      (y * image.width + x) * 4,
      (y * image.width + x) * 4 + 4,
    ),
  );

const opaque = (image: PixelImage) =>
  Array.from(
    { length: image.width * image.height },
    (_, i) => image.data[i * 4 + 3] > 0,
  );

const brightness = ([r, g, b]: number[]) => (r + g + b) / 3;

/** Opaque columns: [first, last]. */
function extent(image: PixelImage): [number, number] {
  const mask = opaque(image);
  const columns = Array.from({ length: image.width }, (_, x) =>
    Array.from(
      { length: image.height },
      (_, y) => mask[y * image.width + x],
    ).some(Boolean),
  );
  return [columns.indexOf(true), columns.lastIndexOf(true)];
}

// A still frame (no swimming wave) for checking the pattern and light.
const still = renderFish({ ...clownfish, wave: { head: 0, tail: 0 } });
const bodyLength = clownfish.snoutX - clownfish.peduncleX;
const xAt = (u: number) => Math.floor(clownfish.snoutX - u * bodyLength);
const midY = (u: number) =>
  Math.floor(clownfish.centerY + (clownfish.bottom(u) - clownfish.top(u)) / 2);

describe("renderFish (clownfish)", () => {
  it("draws a 96 × 60 frame, the same every time", () => {
    expect(still.width).toBe(96);
    expect(still.height).toBe(60);
    expect(still.data).toHaveLength(96 * 60 * 4);
    expect(renderFish(clownfish, { frame: 2 }).data).toEqual(
      renderFish(clownfish, { frame: 2 }).data,
    );
  });

  it("leaves everything around the fish transparent", () => {
    for (const [x, y] of [
      [0, 0],
      [95, 0],
      [0, 59],
      [95, 59],
    ]) {
      expect(pixel(still, x, y)[3]).toBe(0);
    }
    const covered = opaque(still).filter(Boolean).length;
    expect(covered).toBeGreaterThan(1500);
  });

  it("paints three white bands on an orange body", () => {
    // Band centers: behind the eye, middle (sampled above the pectoral fin,
    // where it bulges less), and the tail base.
    for (const [u, dy] of [
      [0.215, 0],
      [0.455, -6],
      [0.905, 0],
    ]) {
      const [r, g, b] = pixel(still, xAt(u), midY(u) + dy);
      expect(Math.min(r, g, b), `u=${u}`).toBeGreaterThan(150);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(40);
    }
    for (const u of [0.33, 0.7]) {
      const [r, g, b] = pixel(still, xAt(u), midY(u));
      expect(r, `u=${u}`).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
      expect(r - b).toBeGreaterThan(120);
    }
  });

  it("edges each white band in black", () => {
    const u = 0.905;
    const y = midY(u);
    const darkest = Math.min(
      ...[-3, -2, 2, 3].map((dx) => brightness(pixel(still, xAt(u) + dx, y))),
    );
    expect(darkest).toBeLessThan(70);
  });

  it("is lit from above: the back is brighter than the belly", () => {
    const x = xAt(0.7);
    const top = midY(0.7) - Math.floor(clownfish.top(0.7) * 0.6);
    const bottom = midY(0.7) + Math.floor(clownfish.bottom(0.7) * 0.6);
    expect(brightness(pixel(still, x, top))).toBeGreaterThan(
      brightness(pixel(still, x, bottom)),
    );
  });
});

describe("animation frames", () => {
  const frames = fishFrames(clownfish);

  it("has four different tail frames each way", () => {
    expect(frames.right).toHaveLength(TAIL_FRAMES);
    expect(frames.left).toHaveLength(TAIL_FRAMES);
    for (let a = 0; a < TAIL_FRAMES; a++) {
      for (let b = a + 1; b < TAIL_FRAMES; b++) {
        expect(frames.right[a].data, `${a} vs ${b}`).not.toEqual(
          frames.right[b].data,
        );
      }
    }
  });

  it("faces left with the mirrored silhouette (light still from the upper left)", () => {
    expect(opaque(frames.left[0])).toEqual(opaque(mirror(frames.right[0])));
  });

  it("turns by narrowing, flipping, and widening", () => {
    const widths = frames.turn.map((image) => {
      const [first, last] = extent(image);
      return last - first;
    });
    const full = extent(frames.right[0])[1] - extent(frames.right[0])[0];
    expect(widths[0]).toBeLessThan(full);
    expect(widths[1]).toBeLessThan(widths[0]);
    expect(widths[2]).toBeLessThan(widths[3]);
    expect(frames.turn[3]).toEqual(squash(frames.left[0], 0.75));
  });

  it("mirrors back to the original", () => {
    expect(mirror(mirror(still)).data).toEqual(still.data);
  });
});

describe("renderTank", () => {
  const tank = renderTank(240, 120);

  it("is fully opaque", () => {
    expect(opaque(tank).every(Boolean)).toBe(true);
  });

  it("darkens with depth and ends in sand", () => {
    const shallow = brightness(pixel(tank, 120, 10));
    const deep = brightness(pixel(tank, 120, 95));
    expect(shallow).toBeGreaterThan(deep);
    const [r, g, b] = pixel(tank, 120, 118);
    expect(r).toBeGreaterThan(b); // sand is warm, water is blue
    expect(g).toBeGreaterThan(b);
  });
});
