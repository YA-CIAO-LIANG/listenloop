import type { HeatLevel } from "@/lib/practice-calendar";

/** Heat-map colors per step (full class names so Tailwind finds them). */
export const HEAT_BACKGROUND: Record<HeatLevel, string> = {
  0: "bg-heat-0",
  1: "bg-heat-1",
  2: "bg-heat-2",
  3: "bg-heat-3",
  4: "bg-heat-4",
};
/** Date numbers stay AA on every step; the darkest steps switch ink. */
export const HEAT_TEXT: Record<HeatLevel, string> = {
  0: "text-ink-muted",
  1: "text-ink",
  2: "text-ink",
  3: "text-heat-ink-strong",
  4: "text-heat-ink-strong",
};
export const HEAT_LEVELS: readonly HeatLevel[] = [0, 1, 2, 3, 4];
