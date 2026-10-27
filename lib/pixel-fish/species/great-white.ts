import { SPECIES_STYLE, eyeRadiusFor } from "../style";
import { pointedFin, profile } from "../shape";
import type { FishSpecies, Paint, PaintInput } from "../types";

type Material = "skin" | "belly" | "fin" | "gill" | "mouth" | "tooth";

const { roundness, palette } = SPECIES_STYLE["great-white"];

const LENGTH = 172 - 60;
/** One pixel along the body, in u. */
const PX = 1 / LENGTH;

// A pointed snout that widens into a stout, torpedo body.
const TOP = profile(
  [
    [0, 1],
    [0.04, 4],
    [0.1, 8],
    [0.2, 11.5],
    [0.35, 13],
    [0.5, 12.2],
    [0.65, 9.5],
    [0.82, 5.5],
    [1, 2.6],
  ],
  roundness,
);
// The lower jaw sits back under the snout.
const BOTTOM = profile(
  [
    [0, 0.5],
    [0.04, 2.4],
    [0.1, 5.6],
    [0.2, 8.5],
    [0.35, 10],
    [0.5, 9.4],
    [0.65, 7.2],
    [0.82, 4.2],
    [1, 2.4],
  ],
  roundness,
);
const headAt = (u: number) => TOP(u) + BOTTOM(u);

/** The countershading line: grey back, white belly, a wavy edge between. */
const bellyLine = (u: number) => 0.18 + 0.07 * Math.sin(u * 24);

/** A small, friendly smile under the snout, corners up. */
const SMILE = { from: 0.035, to: 0.14 };
function smileAt(u: number) {
  const t = (u - (SMILE.from + SMILE.to) / 2) / ((SMILE.to - SMILE.from) / 2);
  return 0.44 + 0.16 * (1 - t * t);
}

function paint({ region, u, v, edge }: PaintInput): Paint<Material> {
  if (region !== "body") {
    return { material: "fin", shade: edge < 1.5 ? -0.08 : 0 };
  }
  // Gill slits behind the eye: short and soft, not deep cuts.
  for (let i = 0; i < 4; i++) {
    const slit = 0.25 + i * 3 * PX;
    if (Math.abs(u - slit) < 0.5 * PX && v > -0.05 && v < 0.3) {
      return { material: "gill", shade: 0.12 };
    }
  }
  if (u > SMILE.from && u < SMILE.to) {
    const line = smileAt(u);
    if (Math.abs(v - line) < 0.06) return { material: "mouth" };
    // Just a few teeth showing: a little grin, not a snarl.
    const column = Math.floor(u / PX);
    if (
      v < line - 0.05 &&
      v > line - 0.2 &&
      column % 3 === 0 &&
      Math.abs(u - 0.0875) < 0.035
    ) {
      return { material: "tooth", shade: 0.3 };
    }
  }
  return { material: v > bellyLine(u) ? "belly" : "skin" };
}

/**
 * Great white shark, 180 × 96 px facing right, in the "realistic colors,
 * big cute eyes" style: still a shark (pointed snout, grey back over a
 * white belly, gill slits, a tall dorsal fin, long pectorals, a crescent
 * tail with the longer upper lobe), but short and chubby (height about 0.36
 * of its length), with a big eye and a small smile showing a few teeth.
 */
export const greatWhite: FishSpecies<Material> = {
  width: 180,
  height: 96,
  snoutX: 172,
  peduncleX: 60,
  centerY: 52,
  top: TOP,
  bottom: BOTTOM,
  fins: [
    // Tall first dorsal: straight leading edge, curved trailing edge.
    { edge: "top", from: 0.36, to: 0.55, height: pointedFin(21, 0.55, 1.6) },
    { edge: "top", from: 0.86, to: 0.9, height: pointedFin(3, 0.5) },
    // Long pectoral fins reaching down and back.
    { edge: "bottom", from: 0.24, to: 0.42, height: pointedFin(17, 0.35) },
    { edge: "bottom", from: 0.72, to: 0.78, height: pointedFin(4, 0.5) },
    { edge: "bottom", from: 0.86, to: 0.9, height: pointedFin(3, 0.5) },
  ],
  caudal: { length: 26, spreadUp: 0.95, spreadDown: 0.6, round: 0, fork: 10 },
  eye: { u: 0.13, dy: -2.5, radius: eyeRadiusFor(headAt(0.13)) },
  wave: { head: 0.3, tail: 4 },
  palette,
  paint,
};
