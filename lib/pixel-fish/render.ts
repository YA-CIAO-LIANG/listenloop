import type {
  Facing,
  FishSpecies,
  PaintInput,
  PixelImage,
  Ramp,
  Region,
} from "./types";

/** Tail frames per swim cycle: middle, up, middle, down. */
export const TAIL_FRAMES = 4;

/** Light comes from the upper left of the world (normalized). */
const LIGHT = normalize([-0.5, -0.85, 0.55]);
const HALF = normalize([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function normalize([x, y, z]: number[]): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

const dot = (a: number[], b: number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Vertical swimming offset (px) at body position u for a tail phase: small
 * at the head, growing toward the tail.
 */
export function waveAt<M extends string>(
  species: FishSpecies<M>,
  u: number,
  phase: number,
): number {
  const amp =
    u <= 1
      ? species.wave.head + (species.wave.tail - species.wave.head) * u * u
      : species.wave.tail + (u - 1) * 4;
  return amp * Math.sin(phase + 1.1 * (1 - Math.min(u, 1.4)));
}

/** The tail phase (radians) of a swim frame: middle, up, middle, down. */
export const phaseOf = (frame: number) =>
  -(frame % TAIL_FRAMES) * (Math.PI / 2);

/**
 * Brightness (about 0.4–1.2) to a ramp step. Rounded surfaces get a little
 * ordered dither for smooth transitions; flat fins don't (it reads as noise).
 */
function toneOf(
  brightness: number,
  x: number,
  y: number,
  dither: boolean,
): number {
  const offset = dither ? (BAYER4[y & 3][x & 3] / 16 - 0.5) * 0.5 : 0;
  const step = Math.floor(((brightness - 0.38) / 0.8) * 5 + offset);
  return Math.max(0, Math.min(4, step));
}

type Pixel = {
  material: string;
  tone: number;
  alpha: number;
};

/**
 * Draws one frame of a fish: per pixel, find what part of the fish it hits
 * (after the swimming wave), ask the species for its material, light it from
 * the upper left, and quantize to the material's 5-tone ramp. A last pass
 * outlines the silhouette in darker tones of the same colors. The eye isn't
 * part of the frame: eyes.ts draws it so expressions don't need new frames.
 */
export function renderFish<M extends string>(
  species: FishSpecies<M>,
  { frame = 0, facing = "right" }: { frame?: number; facing?: Facing } = {},
): PixelImage {
  const { width, height } = species;
  const pixels: (Pixel | null)[] = new Array(width * height).fill(null);
  const sx = facing === "right" ? 1 : -1;
  const phase = phaseOf(frame);
  const bodyLength = species.snoutX - species.peduncleX;
  const uAt = (gx: number) => (species.snoutX - gx) / bodyLength;
  const tailMid = species.centerY + (species.bottom(1) - species.top(1)) / 2;
  const flutter = frame % 2 === 0 ? 1 : 0.72;

  for (let x = 0; x < width; x++) {
    // Geometry faces right; a left-facing fish mirrors it, the light stays put.
    const gx = (facing === "right" ? x : width - 1 - x) + 0.5;
    const u = uAt(gx);
    const wave = waveAt(species, u, phase);

    for (let y = 0; y < height; y++) {
      const gy = y + 0.5 - wave;
      const hit = locate(species, gx, gy, u, tailMid, flutter);
      if (!hit) continue;

      const paint = species.paint(hit.input);
      const brightness = light(hit.input, sx) + (paint.shade ?? 0);
      pixels[y * width + x] = {
        material: paint.material,
        tone: toneOf(brightness, x, y, hit.input.region === "body"),
        alpha: paint.alpha ?? 255,
      };
    }
  }

  outline(pixels, width, height, sx);
  return toImage(
    pixels,
    width,
    height,
    species.palette as Record<string, Ramp>,
  );
}

type Hit = { region: Region; input: PaintInput };

/** Which part of the fish (if any) the geometry point (gx, gy) falls on. */
function locate<M extends string>(
  species: FishSpecies<M>,
  gx: number,
  gy: number,
  u: number,
  tailMid: number,
  flutter: number,
): Hit | null {
  const bodyLength = species.snoutX - species.peduncleX;
  const { centerY } = species;

  // The eye is drawn separately (eyes.ts) and laid over the body.
  const mid0 = (uu: number) =>
    centerY + (species.bottom(uu) - species.top(uu)) / 2;

  const inBody = u >= 0 && u <= 1;
  const top = inBody ? centerY - species.top(u) : 0;
  const bottom = inBody ? centerY + species.bottom(u) : 0;

  // Pectoral fin lies over the body side.
  const p = species.pectoral;
  const pcx = species.snoutX - p.u * bodyLength - p.back;
  const pcy = mid0(p.u) + p.dy;
  const pr = Math.hypot((gx - pcx) / p.rx, (gy - pcy) / (p.ry * flutter));
  if (pr <= 1) {
    return {
      region: "pectoral",
      input: {
        region: "pectoral",
        u,
        v: 0,
        edge: (1 - pr) * Math.min(p.rx, p.ry * flutter),
        ray: rayLine(Math.atan2(gy - pcy, Math.abs(gx - pcx - p.rx)) * 6),
      },
    };
  }

  if (inBody && gy >= top && gy <= bottom) {
    const mid = (top + bottom) / 2;
    const half = (bottom - top) / 2 || 1;
    return {
      region: "body",
      input: {
        region: "body",
        u,
        v: (gy - mid) / half,
        edge: Infinity,
        ray: 0,
      },
    };
  }

  if (inBody) {
    for (const fin of species.fins) {
      if (u < fin.from || u > fin.to) continue;
      const t = (u - fin.from) / (fin.to - fin.from);
      const h = fin.height(t, Math.floor(gx));
      const outer = fin.edge === "top" ? top - h : bottom + h;
      const inside =
        fin.edge === "top"
          ? gy >= outer && gy < top
          : gy > bottom && gy <= outer;
      if (inside) {
        return {
          region: "fin",
          input: {
            region: "fin",
            u,
            v: fin.edge === "top" ? -1 : 1,
            edge: Math.abs(gy - outer),
            ray: rayLine(gx / 2.5),
          },
        };
      }
    }
  }

  // Tail fin: a fan behind the tail base, with a rounded trailing edge.
  const d = species.peduncleX - gx;
  const { length, spread, round } = species.caudal;
  if (d > 0 && d <= length) {
    const base = ((species.top(1) + species.bottom(1)) / 2) * 0.9;
    let half = base + d * spread;
    if (d > length - round) {
      const k = (d - (length - round)) / round;
      half *= Math.sqrt(Math.max(0, 1 - k * k));
    }
    const off = gy - tailMid;
    if (Math.abs(off) <= half) {
      const angle = Math.atan2(off, d);
      return {
        region: "caudal",
        input: {
          region: "caudal",
          u,
          v: 0,
          edge: Math.min(half - Math.abs(off), length - d),
          ray: rayLine(angle * 8),
        },
      };
    }
  }
  return null;
}

/** 1 on thin lines between fin rays (every unit of `position`), else 0. */
function rayLine(position: number): 0 | 1 {
  return position - Math.floor(position) < 0.3 ? 1 : 0;
}

/** Body as a rounded cylinder lit from the upper left; fins as flat sheets. */
function light(input: PaintInput, sx: number): number {
  let normal: [number, number, number];
  if (input.region === "body") {
    const v = Math.max(-0.99, Math.min(0.99, input.v));
    const snout = input.u < 0.12 ? ((0.12 - input.u) / 0.12) * 0.9 : 0;
    normal = normalize([snout * sx, v * 0.95, Math.sqrt(1 - v * v)]);
  } else {
    normal = normalize([0, -0.25, 1]);
  }
  const diffuse = Math.max(0, dot(normal, LIGHT));
  if (input.region !== "body") return 0.62 + 0.42 * diffuse;
  // Water bounces some light back onto the belly, so it never goes muddy.
  const bounce = input.v > 0 ? 0.16 * input.v : 0;
  const specular = Math.pow(Math.max(0, dot(normal, HALF)), 28) * 0.3;
  return 0.5 + 0.58 * diffuse + bounce + specular;
}

/**
 * Selective outline: silhouette pixels take a darker tone of their own
 * color, darkest on the shadow side (below, away from the light).
 */
function outline(
  pixels: (Pixel | null)[],
  width: number,
  height: number,
  sx: number,
) {
  const empty = (x: number, y: number) =>
    x < 0 ||
    y < 0 ||
    x >= width ||
    y >= height ||
    pixels[y * width + x] === null;
  const toward = -sx; // the light's side, in screen x for this facing
  const marks: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = pixels[y * width + x];
      if (!pixel || pixel.material === "glint") continue;
      const shadow = empty(x, y + 1) || empty(x + sx, y);
      const lit = empty(x, y - 1) || empty(x + toward, y);
      if (shadow) marks.push([y * width + x, 0]);
      else if (lit) marks.push([y * width + x, Math.max(0, pixel.tone - 2)]);
    }
  }
  for (const [index, tone] of marks) {
    const pixel = pixels[index]!;
    pixel.tone = Math.min(pixel.tone, tone);
  }
}

function toImage(
  pixels: (Pixel | null)[],
  width: number,
  height: number,
  palette: Record<string, Ramp>,
): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  const cache = new Map<string, [number, number, number]>();
  pixels.forEach((pixel, i) => {
    if (!pixel) return;
    const hex = palette[pixel.material][pixel.tone];
    let rgb = cache.get(hex);
    if (!rgb) {
      rgb = hexToRgb(hex);
      cache.set(hex, rgb);
    }
    data.set([...rgb, pixel.alpha], i * 4);
  });
  return { width, height, data };
}

/** The same image, mirrored left to right. */
export function mirror(image: PixelImage): PixelImage {
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      const to = (y * width + (width - 1 - x)) * 4;
      out.set(data.subarray(from, from + 4), to);
    }
  }
  return { width, height, data: out };
}

/**
 * Squashes an image horizontally around its center (nearest neighbor), for
 * the frames of a turn.
 */
export function squash(image: PixelImage, scale: number): PixelImage {
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(data.length);
  const center = width / 2;
  for (let x = 0; x < width; x++) {
    const source = Math.floor(center + (x + 0.5 - center) / scale);
    if (source < 0 || source >= width) continue;
    for (let y = 0; y < height; y++) {
      const from = (y * width + source) * 4;
      out.set(data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data: out };
}

export type FishFrames = {
  /** Swim cycle facing right / left (TAIL_FRAMES each). */
  right: PixelImage[];
  left: PixelImage[];
  /** From facing right to facing left: narrowing, then widening the other way. */
  turn: PixelImage[];
};

/** Every frame a species needs; render once and cache. */
export function fishFrames<M extends string>(
  species: FishSpecies<M>,
): FishFrames {
  const right = Array.from({ length: TAIL_FRAMES }, (_, frame) =>
    renderFish(species, { frame, facing: "right" }),
  );
  const left = Array.from({ length: TAIL_FRAMES }, (_, frame) =>
    renderFish(species, { frame, facing: "left" }),
  );
  const turn = [
    squash(right[0], 0.75),
    squash(right[0], 0.45),
    squash(left[0], 0.45),
    squash(left[0], 0.75),
  ];
  return { right, left, turn };
}
