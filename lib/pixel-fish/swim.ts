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
/** Fish going after food swim this much faster and rise or sink this fast (px/s). */
const CHASE_SPEED = 1.5;
const CHASE_RISE = 18;

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
    target = null,
  }: {
    mood?: Mood;
    turn?: boolean;
    random?: () => number;
    /** Food to go after (its center, tank pixels), from chasers(). */
    target?: Point | null;
  } = {},
) {
  const hungry = mood === "hungry";
  const chasing = target !== null;
  const speed =
    creature.speed *
    (hungry ? STYLE.hungrySpeed : 1) *
    (chasing ? CHASE_SPEED : 1);
  s.clock += dt;

  if (now >= s.nextBlink) {
    s.blinkUntil = now + STYLE.blinkFor;
    s.nextBlink = randomBlink(now, random);
  }

  if (creature.crawls) {
    // A snail on the sand heads for food resting there.
    if (target && s.wall === "floor" && s.turn === null) {
      const ahead = target.x > s.x + creature.width / 2 ? "right" : "left";
      if (ahead !== s.facing) s.facing = ahead;
    }
    stepSnail(s, creature, tank, speed * dt, random);
    return;
  }

  const lowest = tank.floor - creature.height;
  if (target) {
    // Turn toward the food, and rise or sink so the mouth meets it.
    const ahead = target.x > s.x + creature.width / 2 ? "right" : "left";
    if (ahead !== s.facing && s.turn === null) {
      s.turn = 0;
      s.clock = 0;
    }
    const want = Math.max(
      0,
      Math.min(lowest, target.y - creature.mouth(0, s.facing).y),
    );
    const step = CHASE_RISE * dt;
    s.cruiseY += Math.max(-step, Math.min(step, want - s.cruiseY));
  }
  const depthY = hungry
    ? Math.min(lowest, s.cruiseY + STYLE.hungryDrop * tank.height)
    : s.cruiseY;
  s.y = Math.min(lowest, depthY + Math.sin(s.clock * 1.3 + s.bob) * 3);

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

/** A food pellet; once on the sand it rests until `restUntil`, then dissolves. */
export type Pellet = { x: number; y: number; restUntil?: number };

/** Pellet size (renderPellet) for hit tests. */
const PELLET = { width: 5, height: 4 };

/** Seconds a pellet stays on the sand (time for the snail to get there). */
export const PELLET_REST = 6;

/** How many fish go after each pellet. */
const CHASERS = 2;

export const pelletCenter = (pellet: Pellet): Point => ({
  x: pellet.x + PELLET.width / 2,
  y: pellet.y + PELLET.height / 2,
});

type Mouth = { swimmer: Swimmer; mouth: Point; crawls: boolean };

/**
 * Who goes after which pellet: the CHASERS nearest swimming fish for each
 * pellet still sinking, and a snail for pellets resting on the sand. Returns
 * a target per swimmer (null = carry on).
 */
export function chasers(
  pellets: Pellet[],
  mouths: Mouth[],
): Map<Swimmer, Point> {
  const targets = new Map<Swimmer, Point>();
  for (const pellet of pellets) {
    const center = pelletCenter(pellet);
    const resting = pellet.restUntil !== undefined;
    const near = mouths
      .filter(({ swimmer, crawls }) =>
        crawls ? resting && swimmer.wall === "floor" : !resting,
      )
      .filter(({ swimmer }) => !targets.has(swimmer))
      .sort(
        (a, b) =>
          Math.hypot(a.mouth.x - center.x, a.mouth.y - center.y) -
          Math.hypot(b.mouth.x - center.x, b.mouth.y - center.y),
      )
      .slice(0, CHASERS);
    for (const { swimmer } of near) targets.set(swimmer, center);
  }
  return targets;
}

/**
 * Sinks pellets; one that reaches a mouth is eaten and makes the eater happy
 * for STYLE.happyFor seconds. Snails only eat food lying on the sand, where
 * pellets rest for PELLET_REST seconds before they dissolve.
 */
export function stepPellets(
  pellets: Pellet[],
  mouths: Mouth[],
  tank: Tank,
  dt: number,
  now: number,
): Pellet[] {
  return pellets.filter((pellet) => {
    const floorY = tank.floor - PELLET.height;
    if (pellet.restUntil === undefined) {
      pellet.y = Math.min(floorY, pellet.y + STYLE.sinkSpeed * dt);
      if (pellet.y >= floorY) pellet.restUntil = now + PELLET_REST;
    }
    const center = pelletCenter(pellet);
    const resting = pellet.restUntil !== undefined;
    const eater = mouths.find(
      ({ mouth, crawls }) =>
        (!crawls || resting) &&
        Math.hypot(center.x - mouth.x, center.y - mouth.y) < (crawls ? 9 : 7),
    );
    if (eater) {
      eater.swimmer.happyUntil = now + STYLE.happyFor;
      return false;
    }
    return pellet.restUntil === undefined || now < pellet.restUntil;
  });
}
