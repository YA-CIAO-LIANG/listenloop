import { compose, eyeCenter, eyeOf, renderEye, type EyeSpec } from "./eyes";
import { fishFrames, phaseOf, waveAt, type FishFrames } from "./render";
import {
  rotateCCW,
  rotateCW,
  rotatePointCCW,
  rotatePointCW,
  snailEye,
  snailEyes,
  snailFrames,
  snailMouth,
} from "./snail";
import { clownfish } from "./species/clownfish";
import { greatWhite } from "./species/great-white";
import { whaleShark } from "./species/whale-shark";
import { SPECIES_STYLE, type SpeciesId } from "./style";
import type { Facing, FishSpecies, PixelImage } from "./types";

type Point = { x: number; y: number };

/** The snail on a wall: rotated frames, foot against the glass. */
export type WallFrames = {
  /** Right wall (rotated counterclockwise): climbing up / coming down. */
  rightUp: PixelImage[];
  rightDown: PixelImage[];
  /** Left wall (rotated clockwise). */
  leftUp: PixelImage[];
  leftDown: PixelImage[];
};

/**
 * Everything the aquarium needs about one kind of creature: its frames,
 * eyes (one for a fish, two on the snail's tentacles), mouth, and how it
 * moves. Built once per species and cached.
 */
export type Creature = {
  id: SpeciesId;
  width: number;
  height: number;
  frames: FishFrames;
  eye: EyeSpec;
  /** Eye centers in a swim frame (far eye first). */
  eyes: (frame: number, facing: Facing) => Point[];
  mouth: (frame: number, facing: Facing) => Point;
  /** Snails creep along the floor and walls; fish swim. */
  crawls: boolean;
  speed: number;
  depth: readonly [number, number];
  walls?: WallFrames;
  /** Eye centers on a wall frame (same order as eyes()). */
  wallEyes?: (side: "right" | "left", up: boolean) => Point[];
};

const FISH: Partial<Record<SpeciesId, FishSpecies<string>>> = {
  clownfish: clownfish as FishSpecies<string>,
  "great-white": greatWhite as FishSpecies<string>,
  "whale-shark": whaleShark as FishSpecies<string>,
};

function fishCreature(id: SpeciesId, species: FishSpecies<string>): Creature {
  return {
    id,
    width: species.width,
    height: species.height,
    frames: fishFrames(species),
    eye: eyeOf(species),
    eyes: (frame, facing) => [eyeCenter(species, frame, facing)],
    mouth: (frame, facing) => {
      const mid = species.centerY + (species.bottom(0) - species.top(0)) / 2;
      return {
        x: facing === "right" ? species.snoutX : species.width - species.snoutX,
        y: mid + waveAt(species, 0, phaseOf(frame)),
      };
    },
    crawls: false,
    speed: SPECIES_STYLE[id].speed,
    depth: SPECIES_STYLE[id].depth,
  };
}

function snailCreature(): Creature {
  const frames = snailFrames();
  const { width, height } = frames.right[0];
  return {
    id: "snail",
    width,
    height,
    frames,
    eye: snailEye,
    eyes: (_frame, facing) => snailEyes(facing),
    mouth: (_frame, facing) => snailMouth(facing),
    crawls: true,
    speed: SPECIES_STYLE.snail.speed,
    depth: SPECIES_STYLE.snail.depth,
    // Up the right wall the head points up (right frames turned CCW); back
    // down it points down (left frames turned CCW). The left wall mirrors.
    walls: {
      rightUp: frames.right.map(rotateCCW),
      rightDown: frames.left.map(rotateCCW),
      leftUp: frames.left.map(rotateCW),
      leftDown: frames.right.map(rotateCW),
    },
    wallEyes: (side, up) =>
      side === "right"
        ? snailEyes(up ? "right" : "left").map((p) => rotatePointCCW(p, width))
        : snailEyes(up ? "left" : "right").map((p) => rotatePointCW(p, height)),
  };
}

const cache = new Map<SpeciesId, Creature>();

/** The creature for a species (rendered on first use, then cached). */
export function getCreature(id: SpeciesId): Creature {
  let creature = cache.get(id);
  if (!creature) {
    const species = FISH[id];
    creature = species ? fishCreature(id, species) : snailCreature();
    cache.set(id, creature);
  }
  return creature;
}

const portraits = new Map<SpeciesId, PixelImage>();

/** A still portrait (facing right, eyes open, looking ahead), e.g. for the shop. */
export function portrait(id: SpeciesId): PixelImage {
  let image = portraits.get(id);
  if (!image) {
    const creature = getCreature(id);
    image = creature
      .eyes(0, "right")
      .reduce(
        (base, eye) => compose(base, renderEye(creature.eye), eye.x, eye.y),
        creature.frames.right[0],
      );
    portraits.set(id, image);
  }
  return image;
}
