import { describe, expect, it } from "vitest";
import { fishCatalog } from "@/data/fish";
import { getCreature, portrait } from "@/lib/pixel-fish/creatures";
import { renderFish } from "@/lib/pixel-fish/render";
import {
  rotateCCW,
  rotateCW,
  rotatePointCCW,
  rotatePointCW,
  renderSnail,
  snailEyes,
} from "@/lib/pixel-fish/snail";
import { clownfish } from "@/lib/pixel-fish/species/clownfish";
import { greatWhite } from "@/lib/pixel-fish/species/great-white";
import { whaleShark } from "@/lib/pixel-fish/species/whale-shark";
import {
  SIZES,
  SPECIES_STYLE,
  STYLE,
  type SpeciesId,
} from "@/lib/pixel-fish/style";
import {
  PELLET_REST,
  chasers,
  createSwimmer,
  expressionOf,
  poseOf,
  stepPellets,
  stepSwimmer,
  type Tank,
} from "@/lib/pixel-fish/swim";
import type { PixelImage } from "@/lib/pixel-fish/types";

const pixel = (image: PixelImage, x: number, y: number) =>
  Array.from(
    image.data.subarray(
      (y * image.width + x) * 4,
      (y * image.width + x) * 4 + 4,
    ),
  );
const brightness = ([r, g, b]: number[]) => (r + g + b) / 3;
const opaqueCount = (image: PixelImage) => {
  let count = 0;
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i] > 0) count++;
  return count;
};
/** Opaque width (first to last opaque column). */
function visibleWidth(image: PixelImage) {
  let first = image.width;
  let last = -1;
  for (let x = 0; x < image.width; x++) {
    for (let y = 0; y < image.height; y++) {
      if (image.data[(y * image.width + x) * 4 + 3] > 0) {
        first = Math.min(first, x);
        last = Math.max(last, x);
      }
    }
  }
  return last - first;
}

const fishSpecies = [clownfish, greatWhite, whaleShark];

describe("shared style", () => {
  it("gives every fish an eye about STYLE.eyeToHead of its head height", () => {
    for (const species of fishSpecies) {
      const head = species.top(species.eye.u) + species.bottom(species.eye.u);
      expect((2 * species.eye.radius) / head).toBeCloseTo(STYLE.eyeToHead, 2);
    }
  });

  it("takes each species' palette from the shared style file", () => {
    expect(clownfish.palette).toBe(SPECIES_STYLE.clownfish.palette);
    expect(greatWhite.palette).toBe(SPECIES_STYLE["great-white"].palette);
    expect(whaleShark.palette).toBe(SPECIES_STYLE["whale-shark"].palette);
  });

  it("sizes the four so they look right together: snail < clownfish < shark < whale shark", () => {
    const order: SpeciesId[] = [
      "snail",
      "clownfish",
      "great-white",
      "whale-shark",
    ];
    const widths = order.map((id) =>
      visibleWidth(getCreature(id).frames.right[0]),
    );
    expect([...widths].sort((a, b) => a - b)).toEqual(widths);
    for (const id of order) {
      expect(getCreature(id).width).toBe(SIZES[id].width);
    }
  });

  it("makes the whale shark the slowest swimmer and the snail slowest of all", () => {
    const speed = (id: SpeciesId) => SPECIES_STYLE[id].speed;
    expect(speed("whale-shark")).toBeLessThan(speed("great-white"));
    expect(speed("whale-shark")).toBeLessThan(speed("clownfish"));
    expect(speed("snail")).toBeLessThan(speed("whale-shark"));
  });

  it("has a pixel-art portrait for every fish in the shop", () => {
    for (const fish of fishCatalog) {
      const image = portrait(fish.id as SpeciesId);
      expect(opaqueCount(image), fish.id).toBeGreaterThan(300);
    }
  });
});

describe("great white", () => {
  const still = renderFish({ ...greatWhite, wave: { head: 0, tail: 0 } });
  const length = greatWhite.snoutX - greatWhite.peduncleX;
  const xAt = (u: number) => Math.floor(greatWhite.snoutX - u * length);
  const yAt = (u: number, v: number) =>
    Math.floor(
      greatWhite.centerY +
        (greatWhite.bottom(u) - greatWhite.top(u)) / 2 +
        (v * (greatWhite.top(u) + greatWhite.bottom(u))) / 2,
    );

  it("keeps a pale belly under a blue-grey back", () => {
    const back = pixel(still, xAt(0.5), yAt(0.5, -0.6));
    const belly = pixel(still, xAt(0.5), yAt(0.5, 0.6));
    // Lit from above, so the difference is the color: blue-grey vs. near white.
    expect(back[2] - back[0]).toBeGreaterThan(belly[2] - belly[0] + 8);
    expect(brightness(belly)).toBeGreaterThan(brightness(back));
  });

  it("has a pointed snout (much thinner than the body)", () => {
    const snout = greatWhite.top(0.02) + greatWhite.bottom(0.02);
    const body = greatWhite.top(0.4) + greatWhite.bottom(0.4);
    expect(snout / body).toBeLessThan(0.25);
  });

  it("is chubby for a shark", () => {
    const body = greatWhite.top(0.4) + greatWhite.bottom(0.4);
    expect(body / (greatWhite.snoutX - greatWhite.peduncleX)).toBeGreaterThan(
      0.3,
    );
  });

  it("smiles with a few small teeth, not a mouthful", () => {
    let teeth = 0;
    for (let i = 0; i < still.data.length; i += 4) {
      const [r, g, b, a] = still.data.subarray(i, i + 4);
      if (
        a &&
        r > 230 &&
        g > 230 &&
        b > 230 &&
        (i / 4) % still.width > xAt(0.16)
      )
        teeth++;
    }
    expect(teeth).toBeGreaterThan(0);
    expect(teeth).toBeLessThan(12);
  });

  it("has a crescent tail with the longer lobe on top", () => {
    expect(greatWhite.caudal.spreadUp).toBeGreaterThan(
      greatWhite.caudal.spreadDown,
    );
    expect(greatWhite.caudal.fork).toBeGreaterThan(0);
  });
});

describe("whale shark", () => {
  const still = renderFish({ ...whaleShark, wave: { head: 0, tail: 0 } });

  it("is covered in pale spots on its dark back", () => {
    let spots = 0;
    const length = whaleShark.snoutX - whaleShark.peduncleX;
    for (let u = 0.2; u < 0.8; u += 0.005) {
      const x = Math.floor(whaleShark.snoutX - u * length);
      const mid =
        whaleShark.centerY + (whaleShark.bottom(u) - whaleShark.top(u)) / 2;
      const top = mid - (whaleShark.top(u) + whaleShark.bottom(u)) / 2;
      for (let y = Math.ceil(top) + 2; y < mid; y++) {
        if (brightness(pixel(still, x, y)) > 190) spots++;
      }
    }
    expect(spots).toBeGreaterThan(40);
  });

  it("has a broad, blunt head", () => {
    const head = whaleShark.top(0.02) + whaleShark.bottom(0.02);
    const body = whaleShark.top(0.4) + whaleShark.bottom(0.4);
    expect(head / body).toBeGreaterThan(0.3);
  });
});

describe("snail", () => {
  const snail = renderSnail(0, "right");

  it("carries its eyes on the tentacle tips, above the body", () => {
    const [far, near] = snailEyes("right");
    expect(near.y).toBeLessThan(15);
    expect(far.y).toBeLessThan(15);
    expect(near.x).toBeGreaterThan(far.x);
  });

  it("has a spiral shell: dark grooves alternate with lighter whorls", () => {
    // Walk outward from the coil center along a ray and count dark grooves.
    let grooves = 0;
    let inGroove = false;
    for (let r = 2; r < 11; r += 0.5) {
      const x = Math.round(16.5 + r * 0.7);
      const y = Math.round(15.5 - r * 0.7);
      const dark = brightness(pixel(snail, x, y)) < 85;
      if (dark && !inGroove) grooves++;
      inGroove = dark;
    }
    expect(grooves).toBeGreaterThanOrEqual(2);
  });

  it("turns onto the walls: a quarter turn each way", () => {
    const up = rotateCCW(snail);
    expect([up.width, up.height]).toEqual([snail.height, snail.width]);
    expect(rotateCW(rotateCCW(snail)).data).toEqual(snail.data);
    const tip = snailEyes("right")[1];
    const rotated = rotatePointCCW(tip, snail.width);
    expect(rotated.y).toBeLessThan(snail.width / 2); // head up
    // Turning back (the rotated image is snail.width tall) returns the point.
    expect(rotatePointCW(rotated, snail.width)).toEqual(tip);
  });
});

describe("swim simulation", () => {
  const tank: Tank = { width: 520, height: 260, floor: 248 };
  const fixed = () => 0.5;

  it("keeps fish inside the glass and turns them at the walls", () => {
    const creature = getCreature("clownfish");
    const swimmer = createSwimmer(creature, tank, fixed);
    swimmer.facing = "right";
    let turned = false;
    for (let i = 0; i < 600; i++) {
      stepSwimmer(swimmer, creature, tank, 0.1, i * 0.1, { random: fixed });
      if (swimmer.turn !== null) turned = true;
      expect(swimmer.x).toBeGreaterThanOrEqual(0);
      expect(swimmer.x + creature.width).toBeLessThanOrEqual(tank.width);
      expect(swimmer.y + creature.height).toBeLessThanOrEqual(tank.floor);
    }
    expect(turned).toBe(true);
  });

  it("swims slower and lower when hungry", () => {
    const creature = getCreature("great-white");
    const run = (mood: "normal" | "hungry") => {
      const swimmer = createSwimmer(creature, tank, fixed);
      swimmer.facing = "right";
      swimmer.x = 10;
      const startX = swimmer.x;
      for (let i = 0; i < 10; i++) {
        stepSwimmer(swimmer, creature, tank, 0.1, i * 0.1, {
          mood,
          random: fixed,
        });
      }
      return { moved: swimmer.x - startX, y: swimmer.y };
    };
    const normal = run("normal");
    const hungry = run("hungry");
    expect(hungry.moved).toBeLessThan(normal.moved);
    expect(hungry.y).toBeGreaterThan(normal.y);
  });

  it("lets the snail creep up the glass and back down to the sand", () => {
    const creature = getCreature("snail");
    const swimmer = createSwimmer(creature, tank, fixed);
    swimmer.facing = "right";
    swimmer.x = tank.width - creature.width - 1;
    const walls = new Set<string>();
    const facings = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      stepSwimmer(swimmer, creature, tank, 0.1, i * 0.1, { random: fixed });
      walls.add(`${swimmer.wall}:${swimmer.climbing}`);
      if (swimmer.wall === "floor") facings.add(swimmer.facing);
      const pose = poseOf(swimmer, creature);
      expect(pose.y + pose.image.height).toBeLessThanOrEqual(tank.floor + 0.5);
      expect(pose.x + pose.image.width).toBeLessThanOrEqual(tank.width + 0.5);
    }
    expect(walls).toContain("right:up");
    expect(walls).toContain("right:down");
    expect(walls).toContain("floor:down");
    expect(facings).toEqual(new Set(["right", "left"]));
  });

  it("blinks now and then", () => {
    const creature = getCreature("clownfish");
    const swimmer = createSwimmer(creature, tank, fixed);
    const faces = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const now = i * 0.05;
      stepSwimmer(swimmer, creature, tank, 0.05, now, { random: fixed });
      faces.add(expressionOf(swimmer, now, "normal"));
    }
    expect(faces).toContain("blink");
    expect(faces).toContain("open");
  });

  it("eats a pellet that reaches its mouth and turns happy", () => {
    const creature = getCreature("clownfish");
    const swimmer = createSwimmer(creature, tank, fixed);
    const mouth = poseOf(swimmer, creature).mouth;
    const pellets = stepPellets(
      [{ x: mouth.x - 2.5, y: mouth.y - 2 - STYLE.sinkSpeed * 0.1 }],
      [{ swimmer, mouth, crawls: false }],
      tank,
      0.1,
      5,
    );
    expect(pellets).toEqual([]);
    expect(expressionOf(swimmer, 5.5, "normal")).toBe("happy");
    expect(expressionOf(swimmer, 5 + STYLE.happyFor + 0.1, "normal")).toBe(
      "open",
    );
  });

  it("lets pellets rest on the sand a while, then dissolve", () => {
    const pellets = [{ x: 10, y: tank.floor - 6 }];
    let left = stepPellets(pellets, [], tank, 0.5, 0);
    expect(left).toHaveLength(1);
    expect(left[0].restUntil).toBe(PELLET_REST);
    left = stepPellets(left, [], tank, 0.5, PELLET_REST + 0.1);
    expect(left).toEqual([]);
  });

  it("sends the two nearest fish after sinking food", () => {
    const ids = ["clownfish", "great-white", "whale-shark"] as const;
    const swimmers = ids.map((id) =>
      createSwimmer(getCreature(id), tank, fixed),
    );
    const mouths = swimmers.map((swimmer, i) => ({
      swimmer,
      mouth: { x: 100 + i * 150, y: 100 },
      crawls: false,
    }));
    const targets = chasers([{ x: 98, y: 50 }], mouths);
    expect([...targets.keys()]).toEqual([swimmers[0], swimmers[1]]);
  });

  it("turns a fish toward food behind it and brings its mouth to the food", () => {
    const creature = getCreature("clownfish");
    const swimmer = createSwimmer(creature, tank, fixed);
    swimmer.facing = "right";
    swimmer.x = 200;
    swimmer.cruiseY = 40;
    const food = { x: 20, y: 150 };
    stepSwimmer(swimmer, creature, tank, 0.1, 0, {
      target: food,
      random: fixed,
    });
    expect(swimmer.turn).toBe(0);
    for (let i = 1; i < 30; i++) {
      stepSwimmer(swimmer, creature, tank, 0.1, i * 0.1, {
        target: food,
        random: fixed,
      });
    }
    expect(swimmer.facing).toBe("left");
    expect(swimmer.cruiseY).toBeGreaterThan(40);
  });

  it("lets the snail eat only food lying on the sand", () => {
    const creature = getCreature("snail");
    const snail = createSwimmer(creature, tank, fixed);
    const mouth = poseOf(snail, creature).mouth;
    const sinking = [{ x: mouth.x - 2.5, y: mouth.y - 2 }];
    const mouths = [{ swimmer: snail, mouth, crawls: true }];
    expect(chasers(sinking, mouths).size).toBe(0);
    expect(stepPellets(sinking, mouths, tank, 0, 0)).toHaveLength(1);
    const resting = [{ x: mouth.x - 2.5, y: tank.floor - 4, restUntil: 5 }];
    expect(chasers(resting, mouths).get(snail)).toBeDefined();
    expect(stepPellets(resting, mouths, tank, 0.1, 1)).toEqual([]);
    expect(expressionOf(snail, 1.5, "normal")).toBe("happy");
  });

  it("shows hungry and happy moods", () => {
    const creature = getCreature("whale-shark");
    const swimmer = createSwimmer(creature, tank, fixed);
    swimmer.nextBlink = 1000;
    expect(expressionOf(swimmer, 1, "hungry")).toBe("hungry");
    expect(expressionOf(swimmer, 1, "happy")).toBe("happy");
  });
});
