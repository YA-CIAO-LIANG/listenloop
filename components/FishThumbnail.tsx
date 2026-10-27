import type { Fish } from "@/lib/fish";
import { FishIcon } from "./icons";

/**
 * A fish's picture: the rendered WebP once the aquarium ships, a calm
 * placeholder until then. Decorative: the name is always shown next to it.
 */
export function FishThumbnail({ fish }: { fish: Fish }) {
  return (
    <div
      aria-hidden="true"
      className="flex aspect-[4/3] items-center justify-center rounded-base bg-band text-ink-muted"
    >
      {fish.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- small static WebP, no optimization needed
        <img
          src={fish.thumbnail}
          alt=""
          className="h-full w-full object-contain"
        />
      ) : (
        <FishIcon className="size-16" />
      )}
    </div>
  );
}
