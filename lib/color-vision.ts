/**
 * Color-vision simulation (D217), for checking that two colors meant to
 * tell things apart (listening's orange, writing's teal) stay apart for
 * people with color-vision deficiency. Machado, Oliveira & Fernandes
 * (2009), severity 1.0 (full dichromacy), applied in linear RGB; the
 * difference is CIE76 ΔE in CIELAB (D65). Used by
 * tests/writing-theme.test.ts.
 */
import type { Hex } from "./backgrounds.ts";

export const DEFICIENCIES = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
] as const;
export type Deficiency = (typeof DEFICIENCIES)[number];

type Matrix = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

const MACHADO: Record<Deficiency, Matrix> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

type Vec = [number, number, number];

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (c: number) => {
  const v = Math.min(1, Math.max(0, c));
  return (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255;
};

const linearOf = (hex: Hex): Vec => [
  toLinear(parseInt(hex.slice(1, 3), 16)),
  toLinear(parseInt(hex.slice(3, 5), 16)),
  toLinear(parseInt(hex.slice(5, 7), 16)),
];

const hexOf = (lin: Vec): Hex =>
  `#${lin
    .map((c) => Math.round(fromLinear(c)).toString(16).padStart(2, "0"))
    .join("")}` as Hex;

/** How `hex` looks with the deficiency. */
export function simulate(hex: Hex, deficiency: Deficiency): Hex {
  const m = MACHADO[deficiency];
  const c = linearOf(hex);
  return hexOf(
    m.map((row) => row[0] * c[0] + row[1] * c[1] + row[2] * c[2]) as Vec,
  );
}

/** CIELAB (D65) of a color. */
function lab(hex: Hex): Vec {
  const [r, g, b] = linearOf(hex);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 color difference: about 2.3 is just noticeable; 20+ is clearly different. */
export function deltaE(a: Hex, b: Hex): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
