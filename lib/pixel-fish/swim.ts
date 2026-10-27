import type { Creature } from "./creatures";
import { STYLE } from "./style";
import type { Expression, Facing, PixelImage } from "./types";

/** The tank in pixel-art pixels; `floor` is where the sand starts. */
export type Tank = { width: number; height: number; floor: number };

export type Mood = "normal" | "happy" | "hungry";

type Point = { x: number; y: number };

/** Where a creature is and what it's doing (mutated by stepSwimmer). */
export type Swimmer = {
  id: Creature["id"];
  /** Top-left of the current image, in tank pixels. */
  x: number;
  y: number;
  /** Fish: the depth it cruises at (before bobbing and hunger). */
  cruiseY: number;
  facing: Facing;
  /** Turn frame index while turning, else null. */
  turn: number | null;
  /** Seconds of animation (drives tail frames and bobbing). */
  clock: number;
  bob: number;
  nextBlink: number;
  blinkUntil: number;
  happyUntil: number;
  /** Snail: on the floor, or climbing up / coming down a wall. */
  wall: "floor" | "right" | "left";
  climbing: "up" | "down";
  /** Snail: how high it climbs this time (tank y). */
  climbTo: number;
};

const MARGIN = 4;

const randomBlink = (now: number, random: () => number) =>
  now +
  STYLE.blinkEvery[0] +
  random() * (STYLE.blinkEvery[1] - STYLE.blinkEvery[0]);

/** A swimmer placed in the tank: fish in their depth band, snails on the sand. */
export function createSwimmer(
  creature: Creature,
  tank: Tank,
  random: () => number = Math.random,
  now = 0,
): Swimmer {
  const [top, bottom] = creature.depth;
  const lowest = tank.floor - creature.height;
  const cruiseY = creature.crawls
    ? lowest
    : Math.min(
        lowest,
        top * tank.height +
          random() *
            Math.max(0, (bottom - top) * tank.height - creature.height),
      );
  return {
    id: creature.id,
    x:
      MARGIN + random() * Math.max(0, tank.width - creature.width - 2 * MARGIN),
    y: cruiseY,
    cruiseY,
    facing: random() < 0.5 ? "right" : "left",
    turn: null,
    clock: random() * 10,
    bob: random() * Math.PI * 2,
    nextBlink: randomBlink(now, random),
    blinkUntil: 0,
    happyUntil: 0,
    wall: "floor",
    climbing: "up",
    climbTo: lowest,
  };
}

/**
 * Advances one swimmer by dt seconds. Fish cruise across, bob, and turn at
 * the glass (or on request); hungry fish go slower and lower. Snails creep
 * along the sand, climb a little way up the glass at each end, come back
 * down, and turn. Blinks are scheduled at random.
 */
export function stepSwimmer(
  s: Swimmer,
  creature: Creature,
  tank: Tank,
  dt: number,
  now: number,
  {
    mood = "normal",
    turn = false,
    random = Math.random,
  }: { mood?: Mood; turn?: boolean; random?: () => number } = {},
) {
  const hungry = mood === "hungry";
  const speed = creature.speed * (hungry ? STYLE.hungrySpeed : 1);
  s.clock += dt;

  if (now >= s.nextBlink) {
    s.blinkUntil = now + STYLE.blinkFor;
    s.nextBlink = randomBlink(now, random);
  }

  if (creature.crawls) {
    stepSnail(s, creature, tank, speed * dt, random);
    return;
  }

  const lowest = tank.floor - creature.height;
  const target = hungry
    ? Math.min(lowest, s.cruiseY + STYLE.hungryDrop * tank.height)
    : s.cruiseY;
  s.y = Math.min(lowest, target + Math.sin(s.clock * 1.3 + s.bob) * 3);

  if (s.turn !== null) {
    const step = Math.floor(s.clock * STYLE.frameRate);
    if (step > s.turn) {
      s.turn = step;
      if (s.turn >= creature.frames.turn.length) {
        s.turn = null;
        s.facing = s.facing === "right" ? "left" : "right";
      }
    }
    return;
  }

  s.x += (s.facing === "right" ? 1 : -1) * speed * dt;
  const maxX = tank.width - creature.width - MARGIN;
  const atGlass =
    (s.facing === "right" && s.x >= maxX) ||
    (s.facing === "left" && s.x <= MARGIN);
  if (atGlass || turn) {
    s.x = Math.max(MARGIN, Math.min(maxX, s.x));
    s.turn = 0;
    s.clock = 0;
  }
}

function stepSnail(
  s: Swimmer,
  creature: Creature,
  tank: Tank,
  distance: number,
  random: () => number,
) {
  // On a wall the image is turned: width and height swap.
  const floorY = tank.floor - creature.height;
  const wallFoot = tank.floor - creature.width; // lowest y on a wall
  if (s.wall === "floor") {
    s.y = floorY;
    s.x += (s.facing === "right" ? 1 : -1) * distance;
    if (s.facing === "right" && s.x >= tank.width - creature.width) {
      s.wall = "right";
      s.climbing = "up";
      s.x = tank.width - creature.height;
      s.y = wallFoot;
      s.climbTo = wallFoot - (0.25 + random() * 0.3) * tank.height;
    } else if (s.facing === "left" && s.x <= 0) {
      s.wall = "left";
      s.climbing = "up";
      s.x = 0;
      s.y = wallFoot;
      s.climbTo = wallFoot - (0.25 + random() * 0.3) * tank.height;
    }
    return;
  }
  s.y += s.climbing === "up" ? -distance : distance;
  if (s.climbing === "up" && s.y <= s.climbTo) s.climbing = "down";
  if (s.climbing === "down" && s.y >= wallFoot) {
    // Back on the sand, heading the other way.
    const side = s.wall;
    s.wall = "floor";
    s.facing = side === "right" ? "left" : "right";
    s.x = side === "right" ? tank.width - creature.width - 1 : 1;
    s.y = floorY;
  }
}

/** The expression to show now. */
export function expressionOf(s: Swimmer, now: number, mood: Mood): Expression {
  if (now < s.blinkUntil) return "blink";
  if (mood === "happy" || now < s.happyUntil) return "happy";
  if (mood === "hungry") return "hungry";
  return "open";
}

/** What to draw for a swimmer: the image, where, and its eyes and mouth. */
export function poseOf(
  s: Swimmer,
  creature: Creature,
): { image: PixelImage; x: number; y: number; eyes: Point[]; mouth: Point } {
  const frame =
    Math.floor(s.clock * STYLE.frameRate) % creature.frames.right.length;
  const at = (p: Point) => ({ x: s.x + p.x, y: s.y + p.y });
  if (creature.walls && creature.wallEyes && s.wall !== "floor") {
    const up = s.climbing === "up";
    const set =
      s.wall === "right"
        ? up
          ? creature.walls.rightUp
          : creature.walls.rightDown
        : up
          ? creature.walls.leftUp
          : creature.walls.leftDown;
    const eyes = creature.wallEyes(s.wall, up).map(at);
    return { image: set[frame], x: s.x, y: s.y, eyes, mouth: eyes[0] };
  }
  if (s.turn !== null) {
    const index = s.facing === "right" ? s.turn : 3 - s.turn;
    return {
      image: creature.frames.turn[index],
      x: s.x,
      y: s.y,
      eyes: [],
      mouth: at(creature.mouth(0, s.facing)),
    };
  }
  return {
    image: creature.frames[s.facing][frame],
    x: s.x,
    y: s.y,
    eyes: creature.eyes(frame, s.facing).map(at),
    mouth: at(creature.mouth(frame, s.facing)),
  };
}

export type Pellet = { x: number; y: number };

/** Pellet size (renderPellet) for hit tests. */
const PELLET = { width: 5, height: 4 };

/**
 * Sinks pellets; one that reaches a swimmer's mouth is eaten and makes it
 * happy for STYLE.happyFor seconds. Pellets that reach the sand dissolve.
 */
export function stepPellets(
  pellets: Pellet[],
  mouths: { swimmer: Swimmer; mouth: Point }[],
  tank: Tank,
  dt: number,
  now: number,
): Pellet[] {
  return pellets.filter((pellet) => {
    pellet.y += STYLE.sinkSpeed * dt;
    const center = {
      x: pellet.x + PELLET.width / 2,
      y: pellet.y + PELLET.height / 2,
    };
    const eater = mouths.find(
      ({ mouth }) => Math.hypot(center.x - mouth.x, center.y - mouth.y) < 7,
    );
    if (eater) {
      eater.swimmer.happyUntil = now + STYLE.happyFor;
      return false;
    }
    return pellet.y + PELLET.height < tank.floor;
  });
}
