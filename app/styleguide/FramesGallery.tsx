"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { PixelFish } from "@/components/PixelFish";
import { getCreature } from "@/lib/pixel-fish/creatures";
import { compose, renderEye } from "@/lib/pixel-fish/eyes";
import type { SpeciesId } from "@/lib/pixel-fish/style";
import type { Expression, PixelImage } from "@/lib/pixel-fish/types";

/** Every frame and expression of one species, laid out for checking. */
export function FramesGallery({ species }: { species: SpeciesId }) {
  const t = useTranslations("styleguide.pixelFish");
  const items = useMemo(() => {
    const creature = getCreature(species);
    const withEyes = (
      image: PixelImage,
      points: { x: number; y: number }[],
      expression: Expression = "open",
    ) =>
      points.reduce(
        (base, p) =>
          compose(base, renderEye(creature.eye, { expression }), p.x, p.y),
        image,
      );
    const list = [
      ...creature.frames.right.map((image, i) => ({
        image: withEyes(image, creature.eyes(i, "right")),
        label: t("tail", { n: i + 1 }),
      })),
      ...creature.frames.turn.map((image, i) => ({
        image,
        label: t("turning", { n: i + 1 }),
      })),
      {
        image: withEyes(creature.frames.left[0], creature.eyes(0, "left")),
        label: t("left"),
      },
      ...(["blink", "happy", "hungry"] as const).map((expression) => ({
        image: withEyes(
          creature.frames.right[0],
          creature.eyes(0, "right"),
          expression,
        ),
        label: t(expression),
      })),
    ];
    if (creature.walls && creature.wallEyes) {
      list.push(
        {
          image: withEyes(
            creature.walls.rightUp[0],
            creature.wallEyes("right", true),
          ),
          label: t("climbUp"),
        },
        {
          image: withEyes(
            creature.walls.rightDown[0],
            creature.wallEyes("right", false),
          ),
          label: t("climbDown"),
        },
      );
    }
    return list;
  }, [species, t]);

  const scale = getCreature(species).width > 120 ? 1 : 2;
  return (
    <div>
      <h3 className="mb-3 text-metadata tracking-widest text-ink-muted uppercase">
        {t("frames")}
      </h3>
      <ul className="flex flex-wrap gap-4">
        {items.map(({ image, label }) => (
          <li key={label} className="space-y-1">
            <PixelFish
              image={image}
              scale={scale}
              className="rounded-base bg-band"
            />
            <p className="text-metadata text-ink-muted">{label}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
