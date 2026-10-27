/** An RGBA pixel buffer, row by row (like ImageData, but plain data). */
export type PixelImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

/** Five tones of one material, darkest first (pixel-art color ramp). */
export type Ramp = readonly [string, string, string, string, string];

export type Facing = "right" | "left";

export type EyeMaterial = "iris" | "pupil" | "glint" | "eyelid";

/**
 * open: looking around; blink: closed for a moment; happy: ^ ^ after
 * eating; hungry: lids half closed.
 */
export type Expression = "open" | "blink" | "happy" | "hungry";

/** Where a pixel sits on the fish. */
export type Region = "body" | "fin" | "caudal" | "pectoral";

/** A fin standing on the body's top or bottom edge, between two body positions. */
export type EdgeFin = {
  edge: "top" | "bottom";
  /** Body positions (u: 0 = snout, 1 = tail base) where the fin starts and ends. */
  from: number;
  to: number;
  /** Fin height in pixels at t (0 = front, 1 = back); x allows spiny tips. */
  height: (t: number, x: number) => number;
};

/** What a species' paint() gets for one pixel. */
export type PaintInput = {
  region: Region;
  /** Along the body: 0 = snout, 1 = tail base (beyond 1 on the tail fin). */
  u: number;
  /** Across the body: -1 = back, 1 = belly (body pixels only). */
  v: number;
  /** Pixels to the fin's outer edge (Infinity on the body). */
  edge: number;
  /** Alternates 0 / 1 between neighboring fin rays. */
  ray: 0 | 1;
};

export type Paint<M extends string> = {
  material: M;
  /** Brightness nudge, e.g. -0.06 for a fin ray. */
  shade?: number;
  /** 0–255; fins are slightly see-through. */
  alpha?: number;
};

/**
 * A side-view fish species for the renderer. Geometry is in pixels on a
 * width × height canvas, facing right (snout at snoutX). The palette must
 * include the eye's materials: iris, pupil, glint, and eyelid (the skin
 * around the eye, for blinks and expressions).
 */
export type FishSpecies<M extends string> = {
  width: number;
  height: number;
  snoutX: number;
  /** Where the body narrows into the tail fin. */
  peduncleX: number;
  centerY: number;
  /** Half-heights (px) above and below centerY along the body, u ∈ [0, 1]. */
  top: (u: number) => number;
  bottom: (u: number) => number;
  fins: readonly EdgeFin[];
  /** Fan-shaped tail fin: length (px), how fast it widens, rounded end (px). */
  caudal: { length: number; spread: number; round: number };
  /** Pectoral fin on the side: body position, offset below center, radii. */
  pectoral: { u: number; dy: number; rx: number; ry: number; back: number };
  /** Big round eye (about 1/3 of the head's height across). */
  eye: { u: number; dy: number; radius: number };
  /** Swimming wave amplitude (px) at the head and at the tail base. */
  wave: { head: number; tail: number };
  palette: Record<M | EyeMaterial, Ramp>;
  paint: (input: PaintInput) => Paint<M>;
};
