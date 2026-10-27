import type { FishSpecies, Paint, PaintInput } from "../types";

/** Smooth interpolation through [u, value] points (u ascending). */
function profile(points: readonly [number, number][]) {
  return (u: number) => {
    const clamped = Math.max(0, Math.min(1, u));
    for (let i = 1; i < points.length; i++) {
      const [u1, v1] = points[i];
      if (clamped <= u1) {
        const [u0, v0] = points[i - 1];
        const t = (clamped - u0) / (u1 - u0);
        // Smoothstep between points keeps the outline round, not faceted.
        const s = t * t * (3 - 2 * t);
        return v0 + (v1 - v0) * s;
      }
    }
    return points[points.length - 1][1];
  };
}

type Material = "orange" | "white" | "black" | "fin";

/** Geometry scale: shapes are designed at 64 × 40 and drawn at 96 × 60. */
const K = 1.5;
const scaled = (points: readonly [number, number][]) =>
  points.map(([u, h]) => [u, h * K] as [number, number]);

/** One pixel along the body, in u (body length 63 px). */
const PX = 1 / (42 * K);

/**
 * The three white bands of the ocellaris clownfish (Amphiprion ocellaris):
 * just behind the eye, a middle band bulging toward the head, and the tail
 * base. Each has a thin black border. `c` is the band's center for a v.
 */
const BANDS = [
  { c: (v: number) => 0.215 + 0.015 * v, half: 2.2 * PX },
  { c: (v: number) => 0.5 - 0.06 * (1 - v * v), half: 2.8 * PX },
  { c: () => 0.905, half: 1.8 * PX },
] as const;

const BORDER = 1.2 * PX;

function bandAt(u: number, v: number): "white" | "black" | null {
  for (const band of BANDS) {
    const distance = Math.abs(u - band.c(v));
    if (distance < band.half) return "white";
    if (distance < band.half + BORDER) return "black";
  }
  return null;
}

function paint({ region, u, v, edge, ray }: PaintInput): Paint<Material> {
  if (region === "pectoral") {
    // Paler than the body (thin and lit), with fine rays and a darker rim.
    return {
      material: "fin",
      shade: edge < 1 ? -0.1 : ray ? 0.06 : 0.16,
    };
  }
  if (region === "fin" || region === "caudal") {
    // Black margins on dorsal, anal, pelvic, and tail fins.
    if (edge < 2.5) return { material: "black" };
    // The middle band runs up into the soft dorsal fin.
    if (region === "fin" && v < 0) {
      const band = bandAt(u, -1);
      if (band) return { material: band };
    }
    return { material: "fin", alpha: 240, shade: ray ? -0.1 : 0 };
  }
  // Mouth: a short dark line at the tip of the snout.
  if (u < 0.025 && Math.abs(v - 0.15) < 0.14) return { material: "black" };
  return { material: bandAt(u, v) ?? "orange" };
}

/**
 * Ocellaris clownfish, 96 × 60 px facing right: a deep oval body (height
 * about 0.43 of its length), rounded fins with black margins, three white
 * bands edged in black, bright orange lit from the upper left.
 */
export const clownfish: FishSpecies<Material> = {
  width: 96,
  height: 60,
  snoutX: 88,
  peduncleX: 25,
  centerY: 30,
  top: profile(
    scaled([
      [0, 1.5],
      [0.05, 4],
      [0.12, 6.4],
      [0.25, 8.7],
      [0.4, 9.5],
      [0.55, 9.1],
      [0.7, 7.7],
      [0.85, 5.5],
      [1, 3.4],
    ]),
  ),
  bottom: profile(
    scaled([
      [0, 1],
      [0.05, 3.2],
      [0.12, 5.4],
      [0.25, 7.5],
      [0.4, 8.3],
      [0.55, 7.9],
      [0.7, 6.5],
      [0.85, 4.7],
      [1, 3.4],
    ]),
  ),
  fins: [
    // Spiny dorsal: low, with spine tips every fourth pixel.
    {
      edge: "top",
      from: 0.28,
      to: 0.53,
      height: (t, x) =>
        3.4 *
        K *
        Math.pow(Math.sin(Math.PI * t), 0.6) *
        (x % 4 === 0 ? 1 : 0.8),
    },
    // Soft dorsal: taller and rounded, peaking toward the back.
    {
      edge: "top",
      from: 0.53,
      to: 0.88,
      height: (t) => 6 * K * Math.sin(Math.PI * Math.pow(t, 0.75)),
    },
    // Anal fin.
    {
      edge: "bottom",
      from: 0.6,
      to: 0.88,
      height: (t) => 5 * K * Math.sin(Math.PI * Math.pow(t, 0.8)),
    },
    // Pelvic fin, pointing back.
    {
      edge: "bottom",
      from: 0.28,
      to: 0.44,
      height: (t) => 4 * K * (t < 0.7 ? t / 0.7 : (1 - t) / 0.3),
    },
  ],
  caudal: { length: 11 * K, spread: 0.5, round: 6 * K },
  pectoral: { u: 0.3, dy: 1.6 * K, rx: 5 * K, ry: 2.6 * K, back: 3.5 * K },
  eye: { u: 0.12, dy: -2.4 * K, radius: 2.4 * K },
  wave: { head: 0.3, tail: 3.4 },
  palette: {
    orange: ["#8a2f05", "#c4470a", "#ec6614", "#ff8a33", "#ffb070"],
    white: ["#8b98a0", "#bcc6cb", "#dfe5e7", "#f4f7f7", "#ffffff"],
    black: ["#07070a", "#121318", "#1d1f26", "#2b2d36", "#3d404c"],
    fin: ["#7a2a06", "#b5440d", "#e2661c", "#f9883a", "#ffad6e"],
    pupil: ["#000000", "#06070a", "#0d0f14", "#14171d", "#1b1f27"],
    iris: ["#2a1004", "#5a2709", "#8f4512", "#c4661f", "#e89048"],
    glint: ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"],
  },
  paint,
};
