import type { PixelImage } from "./types";

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Water from the lit surface down to the deep (6 tones). */
const WATER = [
  "#4aa8bd",
  "#3891a8",
  "#287a92",
  "#1c637b",
  "#134c62",
  "#0c3649",
];
const SURFACE = "#8fd3df";
const SAND = ["#6f5f45", "#8f7d5c", "#ad9a74", "#c9b68d", "#e0d0a8"];
const ROCK = ["#2c3236", "#434b50", "#5d666b", "#7a8388", "#98a1a5"];
const WEED = ["#173d22", "#235a2f", "#2f773b", "#43924a", "#62ad5e"];

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Small deterministic hash for sand grain and ripples. */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * A still aquarium in the same pixel-art style as the fish: water darkening
 * with depth (dithered), slanted light shafts, a rippled surface line, a sand
 * floor, a rock, and a few strands of seaweed. Fully opaque.
 */
export function renderTank(width: number, height: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  const put = (x: number, y: number, hex: string) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    data.set([...rgb(hex), 255], (y * width + x) * 4);
  };
  const sandTop = (x: number) =>
    Math.round(height - 12 + 2 * Math.sin(x / 17) + Math.sin(x / 5.3));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const depth = y / height;
      const dither = (BAYER4[y & 3][x & 3] / 16 - 0.5) * 0.9;
      let tone = Math.floor(depth * WATER.length + dither);
      // Light shafts slanting down from the upper left, fading with depth.
      const shaft = (x + y * 0.55) % 46;
      if (shaft < 9 && depth < 0.75 && hash(x >> 1, y >> 1) > depth) tone -= 1;
      tone = Math.max(0, Math.min(WATER.length - 1, tone));
      put(x, y, WATER[tone]);
    }
  }

  // Rippled surface line.
  for (let x = 0; x < width; x++) {
    put(x, 0, SURFACE);
    if (hash(x, 1) > 0.55) put(x, 1, SURFACE);
  }

  // Sand floor, lit from above, with grain.
  for (let x = 0; x < width; x++) {
    const top = sandTop(x);
    for (let y = top; y < height; y++) {
      const fromTop = y - top;
      let tone = fromTop === 0 ? 4 : fromTop < 3 ? 3 : 2;
      if (hash(x, y) > 0.86) tone -= 1;
      if (hash(x + 7, y) > 0.94) tone = Math.min(4, tone + 1);
      put(x, y, SAND[Math.max(0, tone)]);
    }
  }

  // A rock on the sand: a rounded mound lit from the upper left.
  const rockX = Math.round(width * 0.18);
  const rockY = sandTop(rockX) + 2;
  for (let y = rockY - 12; y <= rockY; y++) {
    for (let x = rockX - 16; x <= rockX + 16; x++) {
      const dx = (x - rockX) / 16;
      const dy = (y - rockY) / 12;
      if (dx * dx + dy * dy > 1) continue;
      const lit = -dx * 0.5 - dy * 0.8 + (hash(x, y) - 0.5) * 0.3;
      const edge = dx * dx + dy * dy > 0.82;
      const tone = edge
        ? 0
        : Math.max(1, Math.min(4, Math.round(2 + lit * 2.2)));
      put(x, y, ROCK[tone]);
    }
  }

  // Seaweed: a few strands curving up from the sand.
  for (const [baseX, tall, bend] of [
    [Math.round(width * 0.08), 0.55, 1],
    [Math.round(width * 0.3), 0.35, -1],
    [Math.round(width * 0.82), 0.6, 1],
    [Math.round(width * 0.87), 0.42, -1],
  ] as const) {
    const bottom = sandTop(baseX);
    const top = Math.round(bottom - height * tall);
    for (let y = top; y < bottom; y++) {
      const t = (bottom - y) / (bottom - top);
      const cx = baseX + Math.round(bend * 4 * Math.sin(t * 3.2) * t);
      const half = t > 0.92 ? 0 : 1;
      for (let x = cx - half; x <= cx + half; x++) {
        const side = x - cx;
        const tone = side < 0 ? 3 : side > 0 ? 1 : 2;
        put(x, y, WEED[Math.min(4, tone + (t > 0.6 && side < 0 ? 1 : 0))]);
      }
    }
  }

  return { width, height, data };
}
