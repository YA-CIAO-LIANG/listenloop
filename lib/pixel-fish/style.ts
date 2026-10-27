import type { Ramp } from "./types";

/**
 * Every tunable of the "realistic colors, big cute eyes" style in one place
 * (docs/aquarium.md section 1a). Change a number here and every species
 * and the aquarium follow.
 */
export const STYLE = {
  /** Eye diameter as a share of the head's height at the eye. */
  eyeToHead: 0.38,
  /** Big glint (up-left, toward the light) and small glint, × eye radius. */
  glintBig: 0.3,
  glintSmall: 0.14,
  /** How far the pupil moves toward where it looks, × eye radius. */
  pupilShift: 0.28,
  /** Pupil size, × eye radius. */
  pupil: 0.55,
  /** Random blinks every 2–6 s, each this long. */
  blinkEvery: [2, 6] as const,
  blinkFor: 0.15,
  /** Happy ^ ^ this long after eating. */
  happyFor: 2,
  /** Hungry fish swim this much slower and this far lower (× tank height). */
  hungrySpeed: 0.6,
  hungryDrop: 0.12,
  /** Swim-cycle and turn frames per second. */
  frameRate: 8,
  /** Food pellets sink this fast (px/s). */
  sinkSpeed: 9,
} as const;

/** Per species: how much rounder than life, how fast, where it swims. */
export type SpeciesStyle = {
  /** Body height multiplier (cute: a bit rounder than life). */
  roundness: number;
  /** Cruising speed, in pixel-art pixels per second. */
  speed: number;
  /** Swimming band in the tank, as shares of its height (top, bottom). */
  depth: readonly [number, number];
  palette: Readonly<Record<string, Ramp>>;
};

/** Shared eye colors (the eyelid comes from each species' skin). */
const EYE = {
  pupil: ["#050407", "#0b0a10", "#141219", "#1d1a23", "#27232e"],
  // Dark brown iris that glows warm at the bottom (light through the lens).
  iris: ["#120a08", "#2a1710", "#4a2716", "#74401f", "#a5652f"],
  glint: ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"],
} as const satisfies Record<string, Ramp>;

const ORANGE: Ramp = ["#8a2f05", "#c4470a", "#ec6614", "#ff8a33", "#ffb070"];
const SHARK_GREY: Ramp = [
  "#2e3d4a",
  "#46596a",
  "#62788a",
  "#8399a9",
  "#a9bcc8",
];
const WHALE_BLUE: Ramp = [
  "#16273a",
  "#23394f",
  "#334f67",
  "#466982",
  "#5f84a0",
];
const BELLY: Ramp = ["#8f9aa3", "#b9c3c9", "#dbe2e5", "#f1f4f5", "#ffffff"];

export const SPECIES_STYLE = {
  snail: {
    roundness: 1,
    // Snails creep (pixel-art px per second along the floor and walls).
    speed: 3,
    depth: [1, 1],
    palette: {
      ...EYE,
      shell: ["#3b2414", "#64391c", "#8e5427", "#b97a3c", "#dcaa6a"],
      band: ["#24150c", "#3e2412", "#5c3519", "#7c4a23", "#9c6532"],
      lip: ["#8c7b62", "#b3a184", "#d3c4a6", "#eadfc6", "#fbf4e2"],
      skin: ["#4a443c", "#6e665a", "#958a79", "#b8ad9a", "#d8cfbd"],
      eyelid: ["#4a443c", "#6e665a", "#958a79", "#b8ad9a", "#d8cfbd"],
    },
  },
  clownfish: {
    roundness: 1.12,
    speed: 14,
    depth: [0.25, 0.6],
    palette: {
      ...EYE,
      orange: ORANGE,
      white: ["#8b98a0", "#bcc6cb", "#dfe5e7", "#f4f7f7", "#ffffff"],
      black: ["#07070a", "#121318", "#1d1f26", "#2b2d36", "#3d404c"],
      fin: ["#7a2a06", "#b5440d", "#e2661c", "#f9883a", "#ffad6e"],
      eyelid: ORANGE,
    },
  },
  "great-white": {
    roundness: 1.75,
    speed: 11,
    depth: [0.35, 0.8],
    palette: {
      ...EYE,
      skin: SHARK_GREY,
      belly: BELLY,
      fin: ["#26333f", "#3c4e5d", "#566c7e", "#788fa0", "#9db1bf"],
      gill: ["#1a242d", "#24313c", "#2f3e4b", "#3c4d5b", "#4a5d6c"],
      mouth: ["#3a1a1e", "#5a262b", "#7a3438", "#9a474a", "#b8625f"],
      tooth: ["#c9cdd0", "#dfe2e4", "#eff1f2", "#fafbfb", "#ffffff"],
      eyelid: SHARK_GREY,
    },
  },
  "whale-shark": {
    roundness: 1.75,
    speed: 6,
    depth: [0.1, 0.45],
    palette: {
      ...EYE,
      skin: WHALE_BLUE,
      spot: ["#9fb3c2", "#bccbd6", "#d6e1e8", "#ebf1f5", "#ffffff"],
      belly: BELLY,
      fin: ["#13222f", "#1e3244", "#2c445a", "#3e5a73", "#557590"],
      mouth: ["#101a24", "#1a2733", "#243444", "#304356", "#3e5469"],
      eyelid: WHALE_BLUE,
    },
  },
} as const satisfies Record<string, SpeciesStyle>;

export type SpeciesId = keyof typeof SPECIES_STYLE;

/**
 * Pixel sizes, chosen so the four look right together in one tank: snail <
 * clownfish < great white < whale shark (frame width × height, px).
 */
export const SIZES = {
  snail: { width: 48, height: 34 },
  clownfish: { width: 96, height: 60 },
  "great-white": { width: 180, height: 96 },
  "whale-shark": { width: 270, height: 110 },
} as const satisfies Record<SpeciesId, { width: number; height: number }>;

/** The snail's eyes sit on its tentacle tips: big for their size. */
export const SNAIL_EYE_RADIUS = 2.8;

/** Eye radius for a head of this height (top + bottom at the eye), per STYLE. */
export const eyeRadiusFor = (headHeight: number) =>
  (STYLE.eyeToHead * headHeight) / 2;
