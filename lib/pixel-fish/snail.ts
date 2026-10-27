import type { EyeSpec } from "./eyes";
import {
  LIGHT,
  dot,
  normalize,
  outline,
  squash,
  toImage,
  toneOf,
  type FishFrames,
  type Pixel,
} from "./render";
import { SIZES, SNAIL_EYE_RADIUS, SPECIES_STYLE } from "./style";
import type { Facing, PixelImage, Ramp } from "./types";

const { width: W, height: H } = SIZES.snail;
const palette = SPECIES_STYLE.snail.palette as Record<string, Ramp>;

/** Frames of the creeping foot (a ripple runs along it). */
export const SNAIL_FRAMES = 4;

/** The snail's eye spec (tentacle-tip eyes, same style as the fish). */
export const snailEye: EyeSpec = {
  radius: SNAIL_EYE_RADIUS,
  palette: SPECIES_STYLE.snail.palette,
};

// Geometry facing right (head on the right), in pixels.
const FOOT = { from: 3, to: 44, bottom: 31 };
const SHELL = { cx: 19, cy: 17.5, r: 12 };
/** Spiral center, a little up and back so the shell reads as a cone. */
const COIL = { cx: 16.5, cy: 15.5 };
/** Whorl growth per turn (smaller = more, tighter whorls). */
const GROWTH = 0.14;
const TENTACLES = [
  // Far tentacle first (drawn behind, darker), then the near, longer one.
  { from: [38, 24], to: [38.5, 12.5], shade: -0.18 },
  { from: [41, 24], to: [45.5, 9.5], shade: 0 },
] as const;
/** The head stretches forward a pixel mid-stride. */
const STRETCH = [0, 1, 1, 0];

/** Thickness of the foot (px) along it: thin tail, raised head. */
function footHeight(x: number, stretch: number): number {
  const front = FOOT.to + stretch;
  if (x < FOOT.from || x > front) return 0;
  const t = (x - FOOT.from) / (front - FOOT.from);
  let h = 3 + 4 * t;
  if (t > 0.7) h += 5 * Math.sin(((t - 0.7) / 0.3) * (Math.PI / 2));
  // Round off the front of the head.
  const fromFront = front - x;
  if (fromFront < 4) h *= Math.sqrt(1 - ((4 - fromFront) / 4.5) ** 2);
  return h;
}

/** Distance from p to the segment a–b. */
function segmentDistance(
  px: number,
  py: number,
  [ax, ay]: readonly number[],
  [bx, by]: readonly number[],
) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Shell material and brightness at a point, or null outside the shell. */
function shellAt(gx: number, gy: number, sx: number): [string, number] | null {
  const dx = gx - SHELL.cx;
  const dy = gy - SHELL.cy;
  const d = Math.hypot(dx, dy);
  if (d > SHELL.r || gy >= FOOT.bottom - 2) return null;
  const normal = normalize([
    (dx / SHELL.r) * sx,
    dy / SHELL.r,
    Math.sqrt(Math.max(0.02, 1 - (d / SHELL.r) ** 2)),
  ]);
  const lit = 0.5 + 0.6 * Math.max(0, dot(normal, LIGHT));
  // The opening (aperture) faces forward and down, with a pale lip.
  if (dx > 7 && dy > 4) return ["lip", lit + 0.05];
  const cr = Math.hypot(gx - COIL.cx, gy - COIL.cy);
  if (cr < 1.4) return ["lip", lit + 0.15]; // pale apex
  // Logarithmic spiral: each whorl is a constant factor wider than the last.
  const turns =
    Math.log(Math.max(cr, 0.6) / 1.2) / (2 * Math.PI * GROWTH) +
    Math.atan2(gy - COIL.cy, gx - COIL.cx) / (2 * Math.PI);
  const f = turns - Math.floor(turns);
  if (f < 0.14) return ["band", lit - 0.35]; // growth groove
  if (f > 0.48 && f < 0.64) return ["band", lit - 0.02]; // darker color band
  const fleck = ((gx * 7 + gy * 3) | 0) % 5 === 0 ? -0.06 : 0;
  return ["shell", lit + fleck];
}

/**
 * One frame of the snail facing right or left: a soft grey-brown foot with
 * a ripple running along it, a shell with a realistic logarithmic spiral
 * (growth grooves and darker bands) sitting on its back, and two tentacles
 * whose tips carry the big eyes (drawn separately, like the fish). Lit from
 * the upper left whichever way it faces.
 */
export function renderSnail(frame = 0, facing: Facing = "right"): PixelImage {
  const pixels: (Pixel | null)[] = new Array(W * H).fill(null);
  const sx = facing === "right" ? 1 : -1;
  const phase = (frame % SNAIL_FRAMES) * (Math.PI / 2);
  const stretch = STRETCH[frame % SNAIL_FRAMES];
  const put = (x: number, y: number, material: string, brightness: number) => {
    pixels[y * W + x] = {
      material,
      tone: toneOf(brightness, x, y, material === "shell"),
      alpha: 255,
    };
  };

  for (let x = 0; x < W; x++) {
    const gx = (facing === "right" ? x : W - 1 - x) + 0.5;
    for (let y = 0; y < H; y++) {
      const gy = y + 0.5;

      const shell = shellAt(gx, gy, sx);
      if (shell) {
        put(x, y, shell[0], shell[1]);
        continue;
      }

      // Tentacles (thin stalks) and a short lower feeler.
      const stalk = TENTACLES.find(
        (tentacle) =>
          segmentDistance(gx, gy, tentacle.from, tentacle.to) < 1.05,
      );
      if (stalk) {
        put(x, y, "skin", 0.85 + stalk.shade);
        continue;
      }
      if (segmentDistance(gx, gy, [44 + stretch, 27], [47, 28.5]) < 0.7) {
        put(x, y, "skin", 0.8);
        continue;
      }

      // The foot: a soft cylinder lying on the floor, rippling as it creeps.
      const h = footHeight(gx, stretch);
      const top = FOOT.bottom - h;
      if (h > 0 && gy >= top && gy <= FOOT.bottom) {
        const v = ((gy - top) / h) * 2 - 1;
        const normal = normalize([
          0,
          v * 0.9,
          Math.sqrt(1 - Math.min(0.98, v * v)),
        ]);
        const ripple = Math.sin(gx * 0.7 - phase) > 0.65 ? -0.08 : 0;
        const mottle = ((gx * 13 + gy * 7) | 0) % 9 === 0 ? -0.07 : 0;
        const lit = 0.55 + 0.5 * Math.max(0, dot(normal, LIGHT));
        put(x, y, "skin", lit + ripple + mottle);
      }
    }
  }

  outline(pixels, W, H, sx);
  return toImage(pixels, W, H, palette);
}

/** Eye centers on the tentacle tips (far, then near) for a facing. */
export function snailEyes(facing: Facing) {
  return TENTACLES.map(({ to: [x, y] }) => ({
    x: facing === "right" ? x : W - x,
    y,
  }));
}

/** The snail's mouth (front of the head, low). */
export function snailMouth(facing: Facing) {
  return { x: facing === "right" ? 45 : W - 45, y: 28 };
}

/** Every frame the snail needs, like a fish's (it turns with a squash too). */
export function snailFrames(): FishFrames {
  const right = Array.from({ length: SNAIL_FRAMES }, (_, f) =>
    renderSnail(f, "right"),
  );
  const left = Array.from({ length: SNAIL_FRAMES }, (_, f) =>
    renderSnail(f, "left"),
  );
  return {
    right,
    left,
    turn: [
      squash(right[0], 0.75),
      squash(right[0], 0.45),
      squash(left[0], 0.45),
      squash(left[0], 0.75),
    ],
  };
}

/** Quarter turn counterclockwise (head right → head up; foot on the right). */
export function rotateCCW(image: PixelImage): PixelImage {
  const { width: w, height: h, data } = image;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const from = (y * w + x) * 4;
      out.set(data.subarray(from, from + 4), ((w - 1 - x) * h + y) * 4);
    }
  }
  return { width: h, height: w, data: out };
}

/** Quarter turn clockwise (head left → head up; foot on the left). */
export function rotateCW(image: PixelImage): PixelImage {
  const { width: w, height: h, data } = image;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const from = (y * w + x) * 4;
      out.set(data.subarray(from, from + 4), (x * h + (h - 1 - y)) * 4);
    }
  }
  return { width: h, height: w, data: out };
}

/** Where a point lands after rotateCCW of a w-wide image. */
export const rotatePointCCW = (p: { x: number; y: number }, w: number) => ({
  x: p.y,
  y: w - p.x,
});

/** Where a point lands after rotateCW of an h-tall image. */
export const rotatePointCW = (p: { x: number; y: number }, h: number) => ({
  x: h - p.y,
  y: p.x,
});
