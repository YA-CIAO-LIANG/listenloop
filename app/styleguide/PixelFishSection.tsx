"use client";

import { useTranslations } from "next-intl";
import type { SpeciesId } from "@/lib/pixel-fish/style";
import { AquariumDemo } from "./AquariumDemo";
import { FramesGallery } from "./FramesGallery";

const SPECIES: {
  id: SpeciesId;
  note: "snailNote" | "clownfishNote" | "greatWhiteNote" | "whaleSharkNote";
  tank: { width: number; height: number; scale: "1" | "2" | "3" | "4" };
}[] = [
  {
    id: "snail",
    note: "snailNote",
    tank: { width: 160, height: 90, scale: "3" },
  },
  {
    id: "clownfish",
    note: "clownfishNote",
    tank: { width: 240, height: 120, scale: "3" },
  },
  {
    id: "great-white",
    note: "greatWhiteNote",
    tank: { width: 360, height: 150, scale: "2" },
  },
  {
    id: "whale-shark",
    note: "whaleSharkNote",
    tank: { width: 470, height: 170, scale: "2" },
  },
];

const EVERYONE: SpeciesId[] = [
  "whale-shark",
  "great-white",
  "clownfish",
  "snail",
];

/**
 * The pixel fish on /styleguide: all four together in one tank (to compare
 * sizes and speeds), then each species with its own tank and every frame.
 */
export function PixelFishSection() {
  const t = useTranslations("styleguide.pixelFish");
  const tFish = useTranslations("fish");

  return (
    <div className="space-y-16">
      <p className="max-w-reading text-ink-muted">{t("intro")}</p>

      <section className="space-y-4">
        <h3 className="font-display text-h3">{t("together")}</h3>
        <p className="text-supporting text-ink-muted">{t("togetherHint")}</p>
        <AquariumDemo
          species={EVERYONE}
          width={520}
          height={260}
          scale="2"
          label={t("togetherLabel")}
        />
      </section>

      {SPECIES.map(({ id, note, tank }) => {
        const name = tFish(`${id}.name` as "snail.name");
        return (
          <section key={id} className="space-y-4 border-t border-line pt-8">
            <h3 className="font-display text-h3">{name}</h3>
            <p className="text-supporting text-ink-muted">{t(note)}</p>
            <AquariumDemo
              species={[id]}
              width={tank.width}
              height={tank.height}
              scale={tank.scale}
              label={t("tankLabel", { name })}
            />
            <FramesGallery species={id} />
          </section>
        );
      })}
    </div>
  );
}
