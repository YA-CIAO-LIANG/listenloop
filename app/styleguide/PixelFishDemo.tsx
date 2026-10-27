"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { PixelFish, pixelSource, prepareCanvas } from "@/components/PixelFish";
import { SegmentedControl } from "@/components/SegmentedControl";
import { usePrefersReducedMotion } from "@/components/usePrefersReducedMotion";
import { TAIL_FRAMES, fishFrames } from "@/lib/pixel-fish/render";
import { clownfish } from "@/lib/pixel-fish/species/clownfish";
import { renderTank } from "@/lib/pixel-fish/tank";
import type { Facing } from "@/lib/pixel-fish/types";

const TANK = { width: 240, height: 120 };
/** Swim-cycle and turn frames per second (pixel-art animation pace). */
export const FRAME_RATE = 8;
/** Swimming speed in pixel-art pixels per second. */
const SPEED = 14;
const MARGIN = 4;

type Scale = "2" | "3" | "4";

type Swim = {
  x: number;
  facing: Facing;
  /** Index into the turn frames while turning, else null. */
  turn: number | null;
  clock: number;
};

/**
 * The clownfish sample on /styleguide: it swims back and forth in a small
 * pixel-art tank and turns at the walls. Pause, turn, and zoom (2–4×), plus
 * every frame laid out for checking. With reduced motion the fish stays
 * still; "Turn" flips it.
 */
export function PixelFishDemo() {
  const t = useTranslations("styleguide.pixelFish");
  const reduceMotion = usePrefersReducedMotion();
  const frames = useMemo(() => fishFrames(clownfish), []);
  const tank = useMemo(() => renderTank(TANK.width, TANK.height), []);
  const [scale, setScale] = useState<Scale>("3");
  const [playing, setPlaying] = useState(true);
  const [facing, setFacing] = useState<Facing>("right");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const swim = useRef<Swim>({ x: 60, facing: "right", turn: null, clock: 0 });
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
    const baseY = (TANK.height - clownfish.height) / 2 - 6;

    function draw(state: Swim, frame: number, bob: number) {
      context!.drawImage(background!, 0, 0);
      const image =
        state.turn !== null
          ? frames.turn[state.facing === "right" ? state.turn : 3 - state.turn]
          : frames[state.facing][frame];
      const source = pixelSource(image);
      if (source) {
        context!.drawImage(
          source,
          Math.round(state.x),
          Math.round(baseY + bob),
        );
      }
    }

    if (reduceMotion) {
      draw({ ...swim.current, x: maxX / 2, facing, turn: null }, 0, 0);
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
          state.x += (state.facing === "right" ? 1 : -1) * SPEED * dt;
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
      const frame = Math.floor(state.clock * FRAME_RATE) % TAIL_FRAMES;
      draw(state, frame, Math.sin(state.clock * 1.3) * 3);
      handle = requestAnimationFrame(tick);
    }
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [frames, tank, scale, playing, reduceMotion, facing]);

  function turn() {
    if (reduceMotion) setFacing((f) => (f === "right" ? "left" : "right"));
    else turnRequested.current = true;
  }

  const gallery = [
    ...frames.right.map((image, i) => ({
      image,
      label: t("tail", { n: i + 1 }),
    })),
    ...frames.turn.map((image, i) => ({
      image,
      label: t("turning", { n: i + 1 }),
    })),
    { image: frames.left[0], label: t("left") },
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
          className="block max-w-none"
        />
      </div>
      {reduceMotion && (
        <p className="text-supporting text-ink-muted">{t("reduced")}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {!reduceMotion && (
          <Button variant="secondary" onClick={() => setPlaying((p) => !p)}>
            {playing ? t("pause") : t("play")}
          </Button>
        )}
        <Button variant="secondary" onClick={turn}>
          {t("turn")}
        </Button>
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
