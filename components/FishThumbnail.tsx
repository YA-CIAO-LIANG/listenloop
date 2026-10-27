import type { Fish } from "@/lib/fish";
import { FishIcon } from "./icons";

/**
 * A fish's picture in the shop. A calm placeholder until the pixel-art fish
 * are drawn (lib/pixel-fish). Decorative: the name is always shown next to it.
 */
export function FishThumbnail({ fish }: { fish: Fish }) {
  return (
    <div
      aria-hidden="true"
      data-fish={fish.id}
      className="flex aspect-[4/3] items-center justify-center rounded-base bg-band text-ink-muted"
    >
      <FishIcon className="size-16" />
    </div>
  );
}
