import { SPECIES_STYLE, eyeRadiusFor } from "../style";
import { pointedFin, profile } from "../shape";
import type { FishSpecies, Paint, PaintInput } from "../types";

type Material = "skin" | "spot" | "belly" | "fin" | "mouth";

const { roundness, palette } = SPECIES_STYLE["whale-shark"];

const LENGTH = 262 - 90;
// A broad, flat head with the mouth right at the front, a long body.
const TOP = profile(
  [
    [0, 5],
    [0.03, 8.5],
    [0.1, 12],
    [0.25, 15.5],
    [0.4, 16.5],
    [0.55, 15.5],
    [0.7, 11.5],
    [0.85, 6.5],
    [1, 3],
  ],
  roundness,
);
const BOTTOM = profile(
  [
    [0, 3.5],
    [0.03, 6],
    [0.1, 8.5],
    [0.25, 11],
    [0.4, 11.5],
    [0.55, 10.5],
    [0.7, 8],
    [0.85, 4.8],
    [1, 2.8],
  ],
  roundness,
);
const headAt = (u: number) => TOP(u) + BOTTOM(u);

const bellyLine = (u: number) => 0.3 + 0.06 * Math.sin(u * 18);

/**
 * The whale shark's checkerboard: white spots in staggered columns (smaller
 * and closer on the head), with thin pale stripes between the columns and
 * two pale ridges along the back.
 */
function patternAt(u: number, v: number): Paint<Material> | null {
  const half = (TOP(u) + BOTTOM(u)) / 2;
  const x = u * LENGTH;
  const y = v * half;
  const spacing = u < 0.18 ? 4.5 : 7.5;
  const column = Math.round(x / spacing);
  const row = Math.round((y - (column % 2) * spacing * 0.5) / spacing);
  const sx = column * spacing;
  const sy = row * spacing + (column % 2) * spacing * 0.5;
  const radius = u < 0.18 ? 1 : 1.4;
  if (Math.hypot(x - sx, y - sy) < radius) return { material: "spot" };
  // Faint pale stripes between the columns of spots.
  if (u > 0.18 && Math.abs(x - (column + 0.5) * spacing) < 0.5) {
    return { material: "skin", shade: 0.18 };
  }
  return null;
}

function paint({ region, u, v, edge }: PaintInput): Paint<Material> {
  if (region !== "body") {
    return { material: "fin", shade: edge < 1.5 ? -0.08 : 0 };
  }
  // Wide mouth right at the front of the head, with a gentle smile.
  if (u < 0.022 && v > -0.05 && v < 0.5) return { material: "mouth" };
  if (u < 0.08 && Math.abs(v - (0.48 - 0.9 * u)) < 0.05) {
    return { material: "mouth" };
  }
  if (v > bellyLine(u)) return { material: "belly" };
  return patternAt(u, v) ?? { material: "skin" };
}

/**
 * Whale shark, 270 × 110 px facing right: the biggest fish in the tank
 * and the slowest. A broad flat head with a wide front mouth, dark blue-grey
 * back with white spots and pale stripes, a white belly, a big crescent
 * tail; the big cute eye per the shared style.
 */
export const whaleShark: FishSpecies<Material> = {
  width: 270,
  height: 110,
  snoutX: 262,
  peduncleX: 90,
  centerY: 54,
  top: TOP,
  bottom: BOTTOM,
  fins: [
    { edge: "top", from: 0.45, to: 0.62, height: pointedFin(20, 0.55, 1.5) },
    { edge: "top", from: 0.8, to: 0.85, height: pointedFin(6, 0.5) },
    { edge: "bottom", from: 0.2, to: 0.36, height: pointedFin(19, 0.4) },
    { edge: "bottom", from: 0.7, to: 0.76, height: pointedFin(6, 0.5) },
    { edge: "bottom", from: 0.82, to: 0.86, height: pointedFin(5, 0.5) },
  ],
  caudal: { length: 40, spreadUp: 0.95, spreadDown: 0.6, round: 0, fork: 18 },
  eye: { u: 0.1, dy: -2, radius: eyeRadiusFor(headAt(0.1)) },
  wave: { head: 0.2, tail: 3.5 },
  palette,
  paint,
};
