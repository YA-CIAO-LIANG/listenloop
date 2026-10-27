"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { pixelSource, prepareCanvas } from "@/components/PixelFish";
import { SegmentedControl } from "@/components/SegmentedControl";
import { usePrefersReducedMotion } from "@/components/usePrefersReducedMotion";
import { getCreature, type Creature } from "@/lib/pixel-fish/creatures";
import {
  LOOK_AHEAD,
  lookToward,
  renderEye,
  type Look,
} from "@/lib/pixel-fish/eyes";
import type { SpeciesId } from "@/lib/pixel-fish/style";
import {
  chasers,
  createSwimmer,
  expressionOf,
  poseOf,
  stepPellets,
  stepSwimmer,
  type Mood,
  type Pellet,
  type Swimmer,
  type Tank,
} from "@/lib/pixel-fish/swim";
import { renderPellet, renderTank } from "@/lib/pixel-fish/tank";
import type { Expression, PixelImage } from "@/lib/pixel-fish/types";

type Scale = "1" | "2" | "3" | "4";

const eyes = new Map<string, PixelImage>();

/** A creature's eye for an expression and look, drawn once and reused. */
function eyeImage(creature: Creature, expression: Expression, look: Look) {
  const key = `${creature.id}:${expression}:${look.x}:${look.y}`;
  let image = eyes.get(key);
  if (!image) {
    image = renderEye(creature.eye, { expression, look });
    eyes.set(key, image);
  }
  return image;
}

/** Quantized so a handful of eye images serve every direction. */
const quantize = (look: Look): Look => ({
  x: Math.round(look.x * 2) / 2,
  y: Math.round(look.y * 2) / 2,
});

/** Same layout on every load (and in reduced motion). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type AquariumDemoProps = {
  species: readonly SpeciesId[];
  width: number;
  height: number;
  scale: Scale;
  /** Screen-reader description of the moving tank. */
  label: string;
};

/**
 * A live pixel-art tank for /styleguide: the given species swim (or creep)
 * with random blinks, look at the pointer or sinking food, eat it and turn
 * happy, and go slower and lower when hungry. Buttons preview every
 * expression. With reduced motion nothing moves; expressions are still.
 */
export function AquariumDemo({
  species,
  width,
  height,
  scale: initialScale,
  label,
}: AquariumDemoProps) {
  const t = useTranslations("styleguide.pixelFish");
  const reduceMotion = usePrefersReducedMotion();
  const tank: Tank = useMemo(
    () => ({ width, height, floor: height - 12 }),
    [width, height],
  );
  const background = useMemo(() => renderTank(width, height), [width, height]);
  const pellet = useMemo(() => renderPellet(), []);
  const creatures = useMemo(() => species.map(getCreature), [species]);
  const [scale, setScale] = useState<Scale>(initialScale);
  const [playing, setPlaying] = useState(true);
  const [mood, setMood] = useState<Mood>("normal");
  // Reduced motion: the turn button flips everyone; blink / food show stills.
  const [flipped, setFlipped] = useState(false);
  const [still, setStill] = useState<Expression | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const swimmers = useRef<Swimmer[] | null>(null);
  const pellets = useRef<Pellet[]>([]);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const turnRequested = useRef(false);
  const blinkRequested = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = prepareCanvas(canvas, width, height, Number(scale));
    const water = pixelSource(background);
    const food = pixelSource(pellet);
    if (!context || !water) return;
    if (!swimmers.current) {
      const random = seeded(7);
      swimmers.current = creatures.map((c) => createSwimmer(c, tank, random));
    }
    const list = swimmers.current;

    function draw(now: number, moodNow: Mood, stillFace: Expression | null) {
      context!.drawImage(water!, 0, 0);
      list.forEach((swimmer, i) => {
        const creature = creatures[i];
        const pose = poseOf(swimmer, creature);
        const body = pixelSource(pose.image);
        if (body) {
          context!.drawImage(body, Math.round(pose.x), Math.round(pose.y));
        }
        const expression = stillFace ?? expressionOf(swimmer, now, moodNow);
        const target = pellets.current[0] ?? pointer.current;
        for (const eye of pose.eyes) {
          const look =
            target && !reduceMotion
              ? quantize(lookToward(eye, target))
              : LOOK_AHEAD;
          const image = pixelSource(eyeImage(creature, expression, look));
          if (!image) continue;
          context!.drawImage(
            image,
            Math.round(eye.x - image.width / 2),
            Math.round(eye.y - image.height / 2),
          );
        }
      });
      if (food) {
        for (const p of pellets.current) {
          context!.drawImage(food, Math.round(p.x), Math.round(p.y));
        }
      }
    }

    if (reduceMotion) {
      for (const swimmer of list) {
        if (swimmer.wall === "floor") {
          swimmer.facing = flipped ? "left" : "right";
          swimmer.turn = null;
        }
      }
      const face =
        still ??
        (mood === "happy" ? "happy" : mood === "hungry" ? "hungry" : "open");
      draw(0, mood, face);
      return;
    }

    let last = performance.now();
    let handle = 0;
    function tick(nowMs: number) {
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      const now = nowMs / 1000;
      if (playing) {
        const turn = turnRequested.current;
        turnRequested.current = false;
        const mouths = list.map((swimmer, i) => ({
          swimmer,
          mouth: poseOf(swimmer, creatures[i]).mouth,
          crawls: creatures[i].crawls,
        }));
        const targets = chasers(pellets.current, mouths);
        list.forEach((swimmer, i) =>
          stepSwimmer(swimmer, creatures[i], tank, dt, now, {
            mood,
            turn,
            target: targets.get(swimmer) ?? null,
          }),
        );
        pellets.current = stepPellets(pellets.current, mouths, tank, dt, now);
      }
      if (blinkRequested.current) {
        blinkRequested.current = false;
        for (const swimmer of list) swimmer.blinkUntil = now + 0.3;
      }
      draw(now, mood, null);
      handle = requestAnimationFrame(tick);
    }
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [
    background,
    creatures,
    flipped,
    height,
    mood,
    pellet,
    playing,
    reduceMotion,
    scale,
    still,
    tank,
    width,
  ]);

  function feed() {
    if (reduceMotion) {
      setStill("happy");
      return;
    }
    // Drop the food ahead of the first swimmer.
    const first = swimmers.current?.[0];
    const x = first
      ? first.x +
        (first.facing === "right" ? getCreature(first.id).width + 12 : -16)
      : width / 2;
    pellets.current.push({ x: Math.max(4, Math.min(width - 9, x)), y: 3 });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            pointer.current = {
              x: ((event.clientX - box.left) / box.width) * width,
              y: ((event.clientY - box.top) / box.height) * height,
            };
          }}
          onPointerLeave={() => (pointer.current = null)}
          className="block max-w-none touch-none"
        />
      </div>
      <p className="text-supporting text-ink-muted">
        {reduceMotion ? t("reduced") : t("lookHint")}
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {!reduceMotion && (
          <Button variant="secondary" onClick={() => setPlaying((p) => !p)}>
            {playing ? t("pause") : t("play")}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() =>
            reduceMotion
              ? setFlipped((f) => !f)
              : (turnRequested.current = true)
          }
        >
          {t("turn")}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            reduceMotion
              ? setStill((e) => (e === "blink" ? null : "blink"))
              : (blinkRequested.current = true)
          }
        >
          {t("blink")}
        </Button>
        <Button variant="secondary" onClick={feed}>
          {t("feed")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <SegmentedControl
          legend={t("mood")}
          value={mood}
          options={[
            { value: "normal", label: t("normal") },
            { value: "happy", label: t("happy") },
            { value: "hungry", label: t("hungry") },
          ]}
          onChange={(value) => {
            setMood(value);
            setStill(null);
          }}
          optionWidthClassName="min-w-14"
        />
        <SegmentedControl
          legend={t("scale")}
          value={scale}
          options={[
            { value: "1", label: "1×" },
            { value: "2", label: "2×" },
            { value: "3", label: "3×" },
            { value: "4", label: "4×" },
          ]}
          onChange={setScale}
          optionWidthClassName="w-10"
        />
      </div>
    </div>
  );
}
