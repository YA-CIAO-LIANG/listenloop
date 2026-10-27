"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toLocalDate } from "@/lib/dates";
import { isHungry } from "@/lib/feeding";
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
  pelletCenter,
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
import type { RewardStore } from "@/lib/storage/reward-store";
import { fishOf, TANK_CAPACITY } from "@/lib/wallet";
import { pixelSource, prepareCanvas } from "../PixelFish";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import { isTap, isWaterTarget } from "./tap";
import {
  FED_EVENT,
  feedAt,
  useAquariumWallet,
  type FedDetail,
} from "./useAquariumWallet";

/** Pixel-art zoom: 2× on phones and small windows, 3× from 1024px. */
const WIDE = "(min-width: 64rem)";
/** Frame-rate caps (touch devices are usually phones: save battery). */
const FPS_TOUCH = 30;
const FPS_DESKTOP = 60;

type Viewport = { width: number; height: number; scale: number };

/** Whether this browser can draw on a 2D canvas (else: a plain gradient). */
function canDraw(): boolean {
  try {
    return document.createElement("canvas").getContext("2d") !== null;
  } catch {
    return false;
  }
}

function measure(): Viewport {
  const scale = window.matchMedia?.(WIDE).matches ? 3 : 2;
  return { width: window.innerWidth, height: window.innerHeight, scale };
}

const eyes = new Map<string, PixelImage>();
function eyeImage(creature: Creature, expression: Expression, look: Look) {
  const key = `${creature.id}:${expression}:${look.x}:${look.y}`;
  let image = eyes.get(key);
  if (!image) {
    image = renderEye(creature.eye, { expression, look });
    eyes.set(key, image);
  }
  return image;
}

const quantize = (look: Look): Look => ({
  x: Math.round(look.x * 2) / 2,
  y: Math.round(look.y * 2) / 2,
});

type AquariumBackgroundProps = {
  /** Injected in tests; defaults to localStorage. */
  rewards?: RewardStore;
};

/**
 * The home page's pixel-art aquarium, fixed behind everything. The fish in
 * the tank (My fish) swim with random blinks; a tap on open water (not a
 * card, not a scroll) drops a portion of feed that sinks for the nearest
 * fish to eat. Hungry fish swim slower and lower with half-closed eyes.
 * Reduced motion: one still picture, and feeding just shows happy faces.
 * Without canvas, a plain water gradient. Decorative (aria-hidden): the
 * feed card's button does everything a tap does.
 */
export function AquariumBackground({ rewards }: AquariumBackgroundProps) {
  const { wallet, store } = useAquariumWallet(rewards);
  const reduceMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Rendered only in the browser (ssr: false), so window is there from the start.
  const [viewport, setViewport] = useState<Viewport>(measure);
  const [fallback] = useState(() => !canDraw());
  const [stillHappy, setStillHappy] = useState(false);
  const swimmers = useRef(new Map<string, Swimmer>());
  const pellets = useRef<Pellet[]>([]);

  const today = toLocalDate(new Date());
  const mood: Mood = wallet && isHungry(wallet, today) ? "hungry" : "normal";
  const tankFish = useMemo(() => {
    if (!wallet) return [];
    const { owned, inTank } = fishOf(wallet);
    return owned
      .filter((fish) => inTank.includes(fish.id))
      .slice(0, TANK_CAPACITY)
      .map((fish) => ({ id: fish.id, species: fish.species as SpeciesId }));
  }, [wallet]);
  const tankKey = tankFish.map((fish) => fish.id).join(",");

  // Size the tank to the window (re-measured shortly after a resize).
  useEffect(() => {
    let timer = 0;
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setViewport(measure()), 200);
    };
    window.addEventListener("resize", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", update);
    };
  }, []);

  const tank: Tank = useMemo(() => {
    const width = Math.ceil(viewport.width / viewport.scale);
    const height = Math.ceil(viewport.height / viewport.scale);
    return { width, height, floor: height - 12 };
  }, [viewport]);
  const water = useMemo(() => renderTank(tank.width, tank.height), [tank]);

  // Food from a tap or the feed button drops into the water.
  useEffect(() => {
    function onFed(event: Event) {
      const { point } = (event as CustomEvent<FedDetail>).detail;
      if (reduceMotion) {
        setStillHappy(true);
        return;
      }
      const x = point ? point.x / viewport.scale : tank.width / 2;
      const y = point ? Math.max(2, point.y / viewport.scale) : 2;
      pellets.current.push({
        x: Math.max(2, Math.min(tank.width - 7, x - 2.5)),
        y: Math.min(y, tank.floor - 8),
      });
    }
    window.addEventListener(FED_EVENT, onFed);
    return () => window.removeEventListener(FED_EVENT, onFed);
  }, [reduceMotion, tank, viewport]);

  // A tap on open water feeds; scrolling or dragging (≥ 10px) never does.
  useEffect(() => {
    const downs = new Map<number, { x: number; y: number }>();
    function onDown(event: PointerEvent) {
      downs.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    function onUp(event: PointerEvent) {
      const down = downs.get(event.pointerId);
      downs.delete(event.pointerId);
      if (!down || !isWaterTarget(event.target)) return;
      const up = { x: event.clientX, y: event.clientY };
      if (isTap(down, up)) void feedAt(store, up);
    }
    function onCancel(event: PointerEvent) {
      downs.delete(event.pointerId);
    }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [store]);

  // Draw (and, unless reduced motion, animate) the tank.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fallback) return;
    const context = prepareCanvas(
      canvas,
      tank.width,
      tank.height,
      viewport.scale,
    );
    const background = pixelSource(water);
    if (!context || !background) return;
    const food = pixelSource(renderPellet());

    // Keep each fish's swimmer; add new arrivals, drop fish taken out.
    const list = swimmers.current;
    for (const id of [...list.keys()]) {
      if (!tankFish.some((fish) => fish.id === id)) list.delete(id);
    }
    for (const fish of tankFish) {
      const creature = getCreature(fish.species);
      const existing = list.get(fish.id);
      if (!existing || existing.x + creature.width > tank.width) {
        list.set(fish.id, createSwimmer(creature, tank));
      }
    }
    const entries = tankFish.map((fish) => ({
      swimmer: list.get(fish.id)!,
      creature: getCreature(fish.species),
    }));

    function draw(now: number, face: Expression | null) {
      context!.drawImage(background!, 0, 0);
      const target = pellets.current[0]
        ? pelletCenter(pellets.current[0])
        : null;
      for (const { swimmer, creature } of entries) {
        const pose = poseOf(swimmer, creature);
        const body = pixelSource(pose.image);
        if (body)
          context!.drawImage(body, Math.round(pose.x), Math.round(pose.y));
        const expression = face ?? expressionOf(swimmer, now, mood);
        for (const eye of pose.eyes) {
          const look = target ? quantize(lookToward(eye, target)) : LOOK_AHEAD;
          const image = pixelSource(eyeImage(creature, expression, look));
          if (image) {
            context!.drawImage(
              image,
              Math.round(eye.x - image.width / 2),
              Math.round(eye.y - image.height / 2),
            );
          }
        }
      }
      if (food) {
        for (const pellet of pellets.current) {
          context!.drawImage(food, Math.round(pellet.x), Math.round(pellet.y));
        }
      }
    }

    if (reduceMotion) {
      draw(0, stillHappy ? "happy" : mood === "hungry" ? "hungry" : "open");
      return;
    }

    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    const frameGap = 1000 / (touch ? FPS_TOUCH : FPS_DESKTOP);
    let last = performance.now();
    let lastDraw = 0;
    let handle = 0;
    function tick(nowMs: number) {
      handle = requestAnimationFrame(tick);
      if (document.hidden || nowMs - lastDraw < frameGap - 1) return;
      lastDraw = nowMs;
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      const now = nowMs / 1000;
      const mouths = entries.map(({ swimmer, creature }) => ({
        swimmer,
        mouth: poseOf(swimmer, creature).mouth,
        crawls: creature.crawls,
      }));
      const targets = chasers(pellets.current, mouths);
      for (const { swimmer, creature } of entries) {
        stepSwimmer(swimmer, creature, tank, dt, now, {
          mood,
          target: targets.get(swimmer) ?? null,
        });
      }
      pellets.current = stepPellets(pellets.current, mouths, tank, dt, now);
      draw(now, null);
    }
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
    // tankKey stands in for tankFish (same fish, new array after reloads).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewport,
    tank,
    water,
    tankKey,
    mood,
    reduceMotion,
    stillHappy,
    fallback,
  ]);

  if (fallback) {
    return (
      <div
        aria-hidden="true"
        data-aquarium="fallback"
        className="fixed inset-0 -z-10 bg-linear-to-b from-(--ll-water-top) to-(--ll-water-deep)"
      />
    );
  }
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-aquarium="canvas"
      className="pointer-events-none fixed inset-0 -z-10 bg-(--ll-water-deep)"
    />
  );
}
