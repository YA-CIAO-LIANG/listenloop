import { phaseOf, waveAt } from "./render";
import { STYLE } from "./style";
import type {
  EyeMaterial,
  Expression,
  Facing,
  FishSpecies,
  PixelImage,
  Ramp,
} from "./types";

/** Where the pupil points: -1…1 on each axis (screen directions). */
export type Look = { x: number; y: number };

export const LOOK_AHEAD: Look = { x: 0, y: 0 };

/** What renderEye needs: a size and the eye colors (with the eyelid skin). */
export type EyeSpec = {
  radius: number;
  palette: Readonly<Record<EyeMaterial, Ramp>>;
};

/** A fish species' eye, ready for renderEye. */
export function eyeOf<M extends string>(species: FishSpecies<M>): EyeSpec {
  return { radius: species.eye.radius, palette: species.palette };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The eye's center in a swim frame (screen px), following the body wave.
 * Mirrors with the fish; the eye image itself never mirrors, because the
 * light (and so the glints) stays at the upper left.
 */
export function eyeCenter<M extends string>(
  species: FishSpecies<M>,
  frame: number,
  facing: Facing,
): { x: number; y: number } {
  const { eye } = species;
  const gx = species.snoutX - eye.u * (species.snoutX - species.peduncleX);
  const mid =
    species.centerY + (species.bottom(eye.u) - species.top(eye.u)) / 2;
  const y = mid + eye.dy + waveAt(species, eye.u, phaseOf(frame));
  return { x: facing === "right" ? gx : species.width - gx, y };
}

/** Direction from the eye toward a point, scaled to a Look (-1…1). */
export function lookToward(
  from: { x: number; y: number },
  to: { x: number; y: number },
): Look {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return LOOK_AHEAD;
  // Full deflection once the target is a little way off.
  const reach = Math.min(1, length / 12);
  return { x: (dx / length) * reach, y: (dy / length) * reach };
}

/**
 * One big cute eye (realistic colors, big-eyed proportions): a dark iris
 * that glows a little at the bottom, a pupil that follows `look`, and two
 * glints (a big one up toward the light, a small one opposite). Closed
 * states cover it with eyelid skin: blink (a lash line), happy (^), hungry
 * (lids half down).
 */
export function renderEye(
  eye: EyeSpec,
  {
    expression = "open",
    look = LOOK_AHEAD,
  }: {
    expression?: Expression;
    look?: Look;
  } = {},
): PixelImage {
  const r = eye.radius;
  const size = Math.ceil(r * 2) + 2;
  const c = size / 2;
  const palette = eye.palette;
  const data = new Uint8ClampedArray(size * size * 4);
  const lookDown = expression === "hungry" ? 0.5 : 0;
  const shift = r * STYLE.pupilShift;
  const px = c + Math.max(-1, Math.min(1, look.x)) * shift;
  const py = c + Math.max(-1, Math.min(1, look.y + lookDown)) * shift;
  const lidLine = c - r * 0.05; // hungry: upper lid comes down to here

  const pick = (x: number, y: number): [EyeMaterial, number] | null => {
    const dx = x + 0.5 - c;
    const dy = y + 0.5 - c;
    const d = Math.hypot(dx, dy);
    if (d > r) return null;

    if (expression === "blink" || expression === "happy") {
      if (d > r - 1) return ["eyelid", 1];
      // ^ for happy (center higher), a gently drooping lash line for blink.
      const t = dx / (r * 0.8);
      const curve =
        expression === "happy"
          ? -0.3 * r + 0.6 * r * t * t
          : 0.12 * r + 0.12 * r * t * t;
      if (Math.abs(t) < 1 && Math.abs(dy - curve) < 0.8) return ["pupil", 0];
      return ["eyelid", dy < 0 ? 3 : 2];
    }

    if (expression === "hungry" && y + 0.5 < lidLine) {
      return ["eyelid", d > r - 1 ? 1 : 3];
    }
    if (expression === "hungry" && y + 0.5 < lidLine + 1) return ["pupil", 0];

    if (d > r - 1) return ["iris", 0];
    const big = Math.hypot(
      x + 0.5 - (px - r * 0.32),
      y + 0.5 - (py - r * 0.36),
    );
    if (big < r * STYLE.glintBig) return ["glint", 4];
    const small = Math.hypot(
      x + 0.5 - (px + r * 0.32),
      y + 0.5 - (py + r * 0.3),
    );
    if (small < r * STYLE.glintSmall + 0.35) return ["glint", 4];
    if (Math.hypot(x + 0.5 - px, y + 0.5 - py) < r * STYLE.pupil) {
      return ["pupil", 0];
    }
    return ["iris", dy > r * 0.35 ? 3 : dy > 0 ? 2 : 1];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hit = pick(x, y);
      if (!hit) continue;
      const [material, tone] = hit;
      data.set([...hexToRgb(palette[material][tone]), 255], (y * size + x) * 4);
    }
  }
  return { width: size, height: size, data };
}

/** Draws `top` over `base` with its center at (cx, cy), alpha blended. */
export function compose(
  base: PixelImage,
  top: PixelImage,
  cx: number,
  cy: number,
): PixelImage {
  const data = new Uint8ClampedArray(base.data);
  const x0 = Math.round(cx - top.width / 2);
  const y0 = Math.round(cy - top.height / 2);
  for (let y = 0; y < top.height; y++) {
    for (let x = 0; x < top.width; x++) {
      const bx = x0 + x;
      const by = y0 + y;
      if (bx < 0 || by < 0 || bx >= base.width || by >= base.height) continue;
      const from = (y * top.width + x) * 4;
      const alpha = top.data[from + 3] / 255;
      if (alpha === 0) continue;
      const to = (by * base.width + bx) * 4;
      for (let k = 0; k < 3; k++) {
        data[to + k] = Math.round(
          top.data[from + k] * alpha + data[to + k] * (1 - alpha),
        );
      }
      data[to + 3] = Math.max(data[to + 3], top.data[from + 3]);
    }
  }
  return { width: base.width, height: base.height, data };
}
