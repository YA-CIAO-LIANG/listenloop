"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { PixelFish, pixelSource, prepareCanvas } from "@/components/PixelFish";
import { SegmentedControl } from "@/components/SegmentedControl";
import { usePrefersReducedMotion } from "@/components/usePrefersReducedMotion";
import {
  LOOK_AHEAD,
  compose,
  eyeCenter,
  lookToward,
  renderEye,
  type Look,
} from "@/lib/pixel-fish/eyes";
import { TAIL_FRAMES, fishFrames } from "@/lib/pixel-fish/render";
import { clownfish } from "@/lib/pixel-fish/species/clownfish";
import { renderPellet, renderTank } from "@/lib/pixel-fish/tank";
import type { Expression, Facing, PixelImage } from "@/lib/pixel-fish/types";

const TANK = { width: 240, height: 120 };
/** Swim-cycle and turn frames per second (pixel-art animation pace). */
export const FRAME_RATE = 8;
/** Swimming speed in pixel-art pixels per second (hungry fish are slower). */
const SPEED = 14;
const HUNGRY_SPEED = 8;
const MARGIN = 4;
/** Random blinks every 2–6 seconds, each about 150 ms. */
const BLINK_EVERY = [2, 6] as const;
const BLINK_FOR = 0.15;
/** Pellets sink this fast; the fish is happy this long after eating. */
const SINK_SPEED = 9;
const HAPPY_FOR = 2;

type Mood = "normal" | "happy" | "hungry";
type Scale = "2" | "3" | "4";

type Swim = {
  x: number;
  facing: Facing;
  /** Index into the turn frames while turning, else null. */
  turn: number | null;
  clock: number;
  nextBlink: number;
  blinkUntil: number;
  happyUntil: number;
  pellet: { x: number; y: number } | null;
  pointer: { x: number; y: number } | null;
};

const randomBlink = (now: number) =>
  now + BLINK_EVERY[0] + Math.random() * (BLINK_EVERY[1] - BLINK_EVERY[0]);

/** Quantized so a handful of eye images serve every direction. */
const quantize = (look: Look): Look => ({
  x: Math.round(look.x * 2) / 2,
  y: Math.round(look.y * 2) / 2,
});

const eyes = new Map<string, PixelImage>();

/** The clownfish eye for an expression and look, drawn once and reused. */
function eyeImage(expression: Expression, look: Look): PixelImage {
  const key = `${expression}:${look.x}:${look.y}`;
  let image = eyes.get(key);
  if (!image) {
    image = renderEye(clownfish, { expression, look });
    eyes.set(key, image);
  }
  return image;
}

/**
 * The clownfish sample on /styleguide, in the "realistic colors, big cute
 * eyes" style: it swims back and forth in a pixel-art tank and turns at the
 * walls, blinks now and then, and looks at the pointer (or a sinking
 * pellet). Buttons preview each expression: blink, happy after eating,
 * hungry (half-closed lids, slower, lower). With reduced motion nothing
 * moves; expressions show as still pictures.
 */
export function PixelFishDemo() {
  const t = useTranslations("styleguide.pixelFish");
  const reduceMotion = usePrefersReducedMotion();
  const frames = useMemo(() => fishFrames(clownfish), []);
  const tank = useMemo(() => renderTank(TANK.width, TANK.height), []);
  const pellet = useMemo(() => renderPellet(), []);
  const [scale, setScale] = useState<Scale>("3");
  const [playing, setPlaying] = useState(true);
  const [mood, setMood] = useState<Mood>("normal");
  const [facing, setFacing] = useState<Facing>("right");
  // Reduced motion: expressions shown as still pictures.
  const [stillExpression, setStillExpression] = useState<Expression | null>(
    null,
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const swim = useRef<Swim>({
    x: 60,
    facing: "right",
    turn: null,
    clock: 0,
    nextBlink: randomBlink(0),
    blinkUntil: 0,
    happyUntil: 0,
    pellet: null,
    pointer: null,
  });
  const turnRequested = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = prepareCanvas(
      canvas,
      TANK.width,
      TANK.height,
      Number(scale),
    );
    const background = pixelSource(tank);
    if (!context || !background) return;
    const maxX = TANK.width - clownfish.width - MARGIN;
    const baseY =
      (TANK.height - clownfish.height) / 2 - 6 + (mood === "hungry" ? 10 : 0);

    function draw(
      state: Swim,
      frame: number,
      bob: number,
      expression: Expression,
      look: Look,
    ) {
      context!.drawImage(background!, 0, 0);
      const fy = Math.round(baseY + bob);
      const fx = Math.round(state.x);
      if (state.turn !== null) {
        const index = state.facing === "right" ? state.turn : 3 - state.turn;
        const body = pixelSource(frames.turn[index]);
        if (body) context!.drawImage(body, fx, fy);
      } else {
        const body = pixelSource(frames[state.facing][frame]);
        const eye = pixelSource(eyeImage(expression, look));
        const center = eyeCenter(clownfish, frame, state.facing);
        if (body) context!.drawImage(body, fx, fy);
        if (eye) {
          context!.drawImage(
            eye,
            Math.round(fx + center.x - eye.width / 2),
            Math.round(fy + center.y - eye.height / 2),
          );
        }
      }
      const food = state.pellet && pixelSource(pellet);
      if (state.pellet && food) {
        context!.drawImage(
          food,
          Math.round(state.pellet.x),
          Math.round(state.pellet.y),
        );
      }
    }

    if (reduceMotion) {
      const expression =
        stillExpression ??
        (mood === "happy" ? "happy" : mood === "hungry" ? "hungry" : "open");
      draw(
        { ...swim.current, x: maxX / 2, facing, turn: null, pellet: null },
        0,
        0,
        expression,
        LOOK_AHEAD,
      );
      return;
    }

    let last = performance.now();
    let handle = 0;
    function tick(now: number) {
      const state = swim.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing) {
        state.clock += dt;
        const step = Math.floor(state.clock * FRAME_RATE);
        if (state.turn === null) {
          const speed = mood === "hungry" ? HUNGRY_SPEED : SPEED;
          state.x += (state.facing === "right" ? 1 : -1) * speed * dt;
          const atWall =
            (state.facing === "right" && state.x >= maxX) ||
            (state.facing === "left" && state.x <= MARGIN);
          if (atWall || turnRequested.current) {
            turnRequested.current = false;
            state.x = Math.max(MARGIN, Math.min(maxX, state.x));
            state.turn = 0;
            state.clock = 0;
          }
        } else if (step > state.turn) {
          state.turn = step;
          if (state.turn >= frames.turn.length) {
            state.turn = null;
            state.facing = state.facing === "right" ? "left" : "right";
          }
        }
      }

      const seconds = now / 1000;
      if (seconds >= state.nextBlink) {
        state.blinkUntil = seconds + BLINK_FOR;
        state.nextBlink = randomBlink(seconds);
      }

      const frame = Math.floor(state.clock * FRAME_RATE) % TAIL_FRAMES;
      const bob = Math.sin(state.clock * 1.3) * 3;
      const center = eyeCenter(clownfish, frame, state.facing);
      const eyeAt = { x: state.x + center.x, y: baseY + bob + center.y };

      // A pellet sinks; the fish eats it when it reaches the mouth.
      if (state.pellet) {
        state.pellet.y += SINK_SPEED * dt;
        const snoutX =
          state.x +
          (state.facing === "right"
            ? clownfish.snoutX
            : clownfish.width - clownfish.snoutX);
        const mouthY = baseY + bob + clownfish.centerY;
        if (
          Math.hypot(state.pellet.x + 2 - snoutX, state.pellet.y + 2 - mouthY) <
          7
        ) {
          state.pellet = null;
          state.happyUntil = seconds + HAPPY_FOR;
        } else if (state.pellet.y > TANK.height - 14) {
          state.pellet = null;
        }
      }

      const target = state.pellet ?? state.pointer;
      const look = target ? quantize(lookToward(eyeAt, target)) : LOOK_AHEAD;
      const expression: Expression =
        seconds < state.blinkUntil
          ? "blink"
          : mood === "happy" || seconds < state.happyUntil
            ? "happy"
            : mood === "hungry"
              ? "hungry"
              : "open";
      draw(state, frame, bob, expression, look);
      handle = requestAnimationFrame(tick);
    }
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [
    frames,
    tank,
    pellet,
    scale,
    playing,
    reduceMotion,
    facing,
    mood,
    stillExpression,
  ]);

  function turn() {
    if (reduceMotion) setFacing((f) => (f === "right" ? "left" : "right"));
    else turnRequested.current = true;
  }

  function blink() {
    if (reduceMotion) {
      setStillExpression((e) => (e === "blink" ? null : "blink"));
    } else {
      swim.current.blinkUntil = performance.now() / 1000 + BLINK_FOR * 2;
    }
  }

  function feed() {
    if (reduceMotion) {
      // No sinking pellet: straight to the fed (happy) face.
      setStillExpression("happy");
      return;
    }
    const state = swim.current;
    const ahead = state.facing === "right" ? 1 : -1;
    const snoutX =
      state.x +
      (state.facing === "right"
        ? clownfish.snoutX
        : clownfish.width - clownfish.snoutX);
    const x = Math.max(4, Math.min(TANK.width - 9, snoutX + ahead * 24));
    state.pellet = { x, y: 3 };
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    swim.current.pointer = {
      x: ((event.clientX - box.left) / box.width) * TANK.width,
      y: ((event.clientY - box.top) / box.height) * TANK.height,
    };
  }

  const withEye = (body: PixelImage, expression: Expression, f: Facing) => {
    const center = eyeCenter(clownfish, 0, f);
    return compose(body, eyeImage(expression, LOOK_AHEAD), center.x, center.y);
  };
  const gallery = [
    ...frames.right.map((image, i) => ({
      image: compose(
        image,
        eyeImage("open", LOOK_AHEAD),
        eyeCenter(clownfish, i, "right").x,
        eyeCenter(clownfish, i, "right").y,
      ),
      label: t("tail", { n: i + 1 }),
    })),
    ...frames.turn.map((image, i) => ({
      image,
      label: t("turning", { n: i + 1 }),
    })),
    { image: withEye(frames.left[0], "open", "left"), label: t("left") },
    { image: withEye(frames.right[0], "blink", "right"), label: t("blink") },
    { image: withEye(frames.right[0], "happy", "right"), label: t("happy") },
    { image: withEye(frames.right[0], "hungry", "right"), label: t("hungry") },
  ];

  return (
    <div className="space-y-6">
      <p className="max-w-reading text-supporting text-ink-muted">
        {t("intro")}
      </p>
      <div className="overflow-x-auto">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t("tankLabel")}
          onPointerMove={onPointerMove}
          onPointerLeave={() => (swim.current.pointer = null)}
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
        <Button variant="secondary" onClick={turn}>
          {t("turn")}
        </Button>
        <Button variant="secondary" onClick={blink}>
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
            setStillExpression(null);
          }}
          optionWidthClassName="min-w-14"
        />
        <SegmentedControl
          legend={t("scale")}
          value={scale}
          options={[
            { value: "2", label: "2×" },
            { value: "3", label: "3×" },
            { value: "4", label: "4×" },
          ]}
          onChange={setScale}
          optionWidthClassName="w-10"
        />
      </div>
      <div>
        <h3 className="mb-3 text-metadata tracking-widest text-ink-muted uppercase">
          {t("frames")}
        </h3>
        <ul className="flex flex-wrap gap-4">
          {gallery.map(({ image, label }) => (
            <li key={label} className="space-y-1">
              <PixelFish
                image={image}
                scale={2}
                className="rounded-base bg-band"
              />
              <p className="text-metadata text-ink-muted">{label}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
