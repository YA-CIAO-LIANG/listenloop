import { parseFish, type Fish } from "@/lib/fish";
import clownfish from "./clownfish.json";
import greatWhite from "./great-white.json";
import snail from "./snail.json";
import whaleShark from "./whale-shark.json";

/**
 * Every fish in the shop, cheapest first. Validated at import so a bad file
 * fails the build; tests/fish.test.ts checks every JSON file is listed.
 */
export const fishCatalog: readonly Fish[] = [
  snail,
  clownfish,
  greatWhite,
  whaleShark,
].map(parseFish);

export function getFish(id: string): Fish | undefined {
  return fishCatalog.find((fish) => fish.id === id);
}
