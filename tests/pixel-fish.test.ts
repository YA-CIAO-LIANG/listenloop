import { describe, expect, it } from "vitest";
import {
  TAIL_FRAMES,
  fishFrames,
  mirror,
  renderFish,
  squash,
} from "@/lib/pixel-fish/render";
import {
  compose,
  eyeCenter,
  lookToward,
  renderEye,
  eyeOf,
} from "@/lib/pixel-fish/eyes";
import { clownfish } from "@/lib/pixel-fish/species/clownfish";
import { renderPellet, renderTank } from "@/lib/pixel-fish/tank";
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
/** Row at body position u, across the body v (-1 back … 1 belly). */
const yAt = (u: number, v: number) =>
  Math.floor(
    clownfish.centerY +
      (clownfish.bottom(u) - clownfish.top(u)) / 2 +
      (v * (clownfish.top(u) + clownfish.bottom(u))) / 2,
  );

describe("renderFish (clownfish)", () => {
  it("has a short round body (height about 0.55 of its length)", () => {
    const height = clownfish.top(0.4) + clownfish.bottom(0.4);
    const length = clownfish.snoutX - clownfish.peduncleX;
    expect(height / length).toBeGreaterThan(0.5);
    expect(height / length).toBeLessThan(0.62);
  });

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
    // Band centers: behind the big eye, the middle band (above the pectoral
    // fin, where it bulges less), and the tail base.
    for (const [u, v] of [
      [0.315, 0],
      [0.57 - 0.06 * (1 - 0.36), -0.6],
      [0.9, 0],
    ]) {
      const [r, g, b] = pixel(still, xAt(u), yAt(u, v));
      expect(Math.min(r, g, b), `u=${u}`).toBeGreaterThan(150);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(40);
    }
    for (const u of [0.2, 0.72]) {
      const [r, g, b] = pixel(still, xAt(u), midY(u));
      expect(r, `u=${u}`).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
      expect(r - b).toBeGreaterThan(120);
    }
  });

  it("edges each white band in black", () => {
    const u = 0.9;
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

describe("big cute eyes", () => {
  const r = clownfish.eye.radius;
  const isWhite = ([red, g, b, a]: number[]) =>
    a > 0 && red > 240 && g > 240 && b > 240;
  const isDark = ([red, g, b, a]: number[]) => a > 0 && red + g + b < 120;
  const cells = (image: PixelImage) =>
    Array.from({ length: image.width * image.height }, (_, i) => ({
      x: i % image.width,
      y: Math.floor(i / image.width),
      color: Array.from(image.data.subarray(i * 4, i * 4 + 4)),
    }));

  it("is about a third of the head's height across", () => {
    const head =
      clownfish.top(clownfish.eye.u) + clownfish.bottom(clownfish.eye.u);
    expect((2 * r) / head).toBeGreaterThan(0.3);
    expect((2 * r) / head).toBeLessThan(0.42);
  });

  it("has a dark pupil and two separate white glints (one big, one small)", () => {
    const eye = renderEye(eyeOf(clownfish));
    const white = cells(eye).filter((c) => isWhite(c.color));
    expect(cells(eye).filter((c) => isDark(c.color)).length).toBeGreaterThan(
      10,
    );
    // The big glint sits up and left (toward the light), the small one down and right.
    const center = eye.width / 2;
    const upperLeft = white.filter((c) => c.x < center && c.y < center);
    const lowerRight = white.filter((c) => c.x >= center && c.y >= center);
    expect(upperLeft.length).toBeGreaterThan(lowerRight.length);
    expect(lowerRight.length).toBeGreaterThan(0);
    // Round: the corners stay transparent.
    expect(eye.data[3]).toBe(0);
  });

  it("moves the pupil toward where it looks", () => {
    const darkX = (look: { x: number; y: number }) => {
      const dark = cells(renderEye(eyeOf(clownfish), { look })).filter((c) =>
        isDark(c.color),
      );
      return dark.reduce((sum, c) => sum + c.x, 0) / dark.length;
    };
    expect(darkX({ x: 1, y: 0 })).toBeGreaterThan(darkX({ x: -1, y: 0 }));
    expect(lookToward({ x: 0, y: 0 }, { x: 30, y: 0 }).x).toBeCloseTo(1);
    expect(lookToward({ x: 0, y: 0 }, { x: 0.5, y: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("closes for a blink: eyelid skin and a lash line, no glints", () => {
    const eye = renderEye(eyeOf(clownfish), { expression: "blink" });
    expect(cells(eye).some((c) => isWhite(c.color))).toBe(false);
    expect(cells(eye).filter((c) => isDark(c.color)).length).toBeGreaterThan(3);
    const [red, g, b] = pixel(eye, Math.floor(eye.width / 2), 2);
    expect(red).toBeGreaterThan(b + 80); // orange skin
    expect(g).toBeGreaterThan(b);
  });

  it("smiles ^ ^ when happy: the line is higher in the middle", () => {
    const dark = cells(
      renderEye(eyeOf(clownfish), { expression: "happy" }),
    ).filter((c) => isDark(c.color));
    const middle = Math.round(renderEye(eyeOf(clownfish)).width / 2);
    const rowAt = (x: number) =>
      Math.min(...dark.filter((c) => c.x === x).map((c) => c.y));
    expect(rowAt(middle)).toBeLessThan(rowAt(middle - Math.floor(r * 0.7)));
  });

  it("half-closes when hungry: lid on top, eye below", () => {
    const eye = renderEye(eyeOf(clownfish), { expression: "hungry" });
    const mid = Math.floor(eye.width / 2);
    const [red, , b] = pixel(eye, mid, 2);
    expect(red).toBeGreaterThan(b + 80); // lid skin
    // Below the lid the open eye shows: much darker than the skin above.
    expect(brightness(pixel(eye, mid, eye.height - 3))).toBeLessThan(
      brightness(pixel(eye, mid, 2)) / 2,
    );
  });

  it("rides the body wave and mirrors with the fish", () => {
    const ys = [0, 1, 2, 3].map(
      (frame) => eyeCenter(clownfish, frame, "right").y,
    );
    expect(new Set(ys).size).toBeGreaterThan(1);
    const right = eyeCenter(clownfish, 0, "right");
    const left = eyeCenter(clownfish, 0, "left");
    expect(left.x).toBeCloseTo(clownfish.width - right.x);
    expect(left.y).toBeCloseTo(right.y);
  });

  it("composes the eye over the body", () => {
    const center = eyeCenter(clownfish, 0, "right");
    const withEye = compose(
      still,
      renderEye(eyeOf(clownfish)),
      center.x,
      center.y,
    );
    expect(withEye.data).not.toEqual(still.data);
    expect(
      isDark(pixel(withEye, Math.round(center.x), Math.round(center.y))),
    ).toBe(true);
  });
});

describe("renderPellet", () => {
  it("is a small brown crumb", () => {
    const food = renderPellet();
    expect([food.width, food.height]).toEqual([5, 4]);
    const [r, g, b] = pixel(food, 2, 1);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });
});
